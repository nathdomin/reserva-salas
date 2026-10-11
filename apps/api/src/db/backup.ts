import { randomBytes } from 'node:crypto';
import type pg from 'pg';
import { readMigrations } from './migrate';

/**
 * Backup dos DADOS do sistema em um arquivo .sql (a estrutura vem das migrações).
 *
 * Inclui usuários (com o hash das senhas, nunca a senha), salas, reservas, histórico e
 * configurações. Não inclui sessões: depois de restaurar, todos entram de novo.
 * O arquivo contém dados pessoais: guarde-o com o mesmo cuidado que o banco.
 */

/** Ordem de restauração (respeita as chaves estrangeiras). */
const TABELAS = [
  { nome: 'usuarios', ordem: 'criado_em, id' },
  { nome: 'salas', ordem: 'criado_em, id' },
  { nome: 'configuracoes', ordem: 'id' },
  { nome: 'reservas', ordem: 'criado_em, id' },
  { nome: 'auditoria', ordem: 'id' },
] as const;

const MARCADOR = '-- reserva-salas-backup ';

export interface CabecalhoBackup {
  versao: 1;
  geradoEm: string;
  migracoes: string[];
  linhas: Record<string, number>;
}

/** Gera o conteúdo do arquivo de backup a partir do banco. */
export async function gerarBackup(client: pg.ClientBase, agora = new Date()): Promise<string> {
  // Leitura consistente: todas as tabelas no mesmo instante.
  await client.query('begin isolation level repeatable read read only');
  try {
    const { rows: migracoes } = await client.query<{ nome: string }>(
      'select nome from reserva.migracoes order by nome',
    );
    const dados: { nome: string; json: string; linhas: number }[] = [];
    for (const t of TABELAS) {
      const { rows } = await client.query<{ json: string; linhas: number }>(
        `select coalesce(json_agg(t order by ${t.ordem}), '[]')::text as json, count(*)::int as linhas
           from reserva.${t.nome} t`,
      );
      dados.push({ nome: t.nome, json: rows[0]!.json, linhas: rows[0]!.linhas });
    }
    await client.query('commit');

    const cabecalho: CabecalhoBackup = {
      versao: 1,
      geradoEm: agora.toISOString(),
      migracoes: migracoes.map((m) => m.nome),
      linhas: Object.fromEntries(dados.map((d) => [d.nome, d.linhas])),
    };

    // Delimitador aleatório: nenhum texto digitado pelos usuários consegue "fechar" o bloco.
    let tag: string;
    do {
      tag = `$dados_${randomBytes(6).toString('hex')}$`;
    } while (dados.some((d) => d.json.includes(tag)));

    const partes = [
      `${MARCADOR}${JSON.stringify(cabecalho)}`,
      `-- Backup dos dados do sistema Reserva de Salas, gerado em ${cabecalho.geradoEm}.`,
      '-- CONTÉM DADOS PESSOAIS. Guarde em local protegido e não envie por e-mail.',
      '-- Restaurar: npm run db:restaurar -- <arquivo>   (veja docs/MANUTENCAO.md)',
      '',
      'begin;',
      'set local search_path to reserva, extensions, public;',
      // A linha padrão de configurações é substituída pela do backup.
      'delete from reserva.configuracoes;',
    ];
    for (const d of dados) {
      const overriding = d.nome === 'auditoria' ? ' overriding system value' : '';
      partes.push(
        `insert into reserva.${d.nome}${overriding}`,
        `  select * from json_populate_recordset(null::reserva.${d.nome}, ${tag}${d.json}${tag});`,
      );
    }
    partes.push(
      // A numeração do histórico continua de onde parou.
      "select setval(pg_get_serial_sequence('reserva.auditoria', 'id'), coalesce(max(id), 0) + 1, false) from reserva.auditoria;",
      'commit;',
      '',
    );
    return partes.join('\n');
  } catch (error) {
    await client.query('rollback').catch(() => undefined);
    throw error;
  }
}

/** Lê o cabeçalho da primeira linha do arquivo (null se não for um backup deste sistema). */
export function lerCabecalho(conteudo: string): CabecalhoBackup | null {
  const primeira = conteudo.split('\n', 1)[0] ?? '';
  if (!primeira.startsWith(MARCADOR)) return null;
  try {
    return JSON.parse(primeira.slice(MARCADOR.length)) as CabecalhoBackup;
  } catch {
    return null;
  }
}

export class RestauracaoRecusada extends Error {}

/**
 * Restaura um backup num banco com a estrutura já criada.
 * Por segurança, só aceita banco sem dados (sem usuários, salas, reservas nem histórico),
 * a menos que `substituir` seja true — nesse caso os dados atuais são apagados antes.
 */
export async function restaurarBackup(
  client: pg.ClientBase,
  conteudo: string,
  opcoes: { substituir?: boolean } = {},
): Promise<CabecalhoBackup> {
  const cabecalho = lerCabecalho(conteudo.replace(/\r\n/g, '\n'));
  if (!cabecalho) {
    throw new RestauracaoRecusada('O arquivo não é um backup do sistema Reserva de Salas.');
  }

  const { rows: aplicadas } = await client.query<{ nome: string }>(
    'select nome from reserva.migracoes order by nome',
  );
  const nomesAplicados = aplicadas.map((m) => m.nome);
  const faltando = cabecalho.migracoes.filter((m) => !nomesAplicados.includes(m));
  if (faltando.length > 0) {
    throw new RestauracaoRecusada(
      `O banco de destino não tem as migrações ${faltando.join(', ')}. Rode "npm run db:migrate" antes.`,
    );
  }
  const conhecidas = new Set(readMigrations().map((m) => m.nome));
  if (cabecalho.migracoes.some((m) => !conhecidas.has(m))) {
    throw new RestauracaoRecusada(
      'O backup veio de uma versão mais nova do sistema. Atualize o sistema antes de restaurar.',
    );
  }

  const { rows } = await client.query<{ total: number }>(
    `select (select count(*) from reserva.usuarios) + (select count(*) from reserva.salas)
          + (select count(*) from reserva.reservas) + (select count(*) from reserva.auditoria)
          as total`,
  );
  const temDados = (rows[0]?.total ?? 0) > 0;
  if (temDados && !opcoes.substituir) {
    throw new RestauracaoRecusada(
      'O banco de destino já tem dados. Para apagá-los e restaurar o backup, use --substituir.',
    );
  }

  // Tudo numa transação só: se qualquer parte falhar, o banco fica como estava.
  await client.query('begin');
  try {
    if (temDados) {
      await client.query(
        'truncate reserva.sessoes, reserva.reservas, reserva.salas, reserva.auditoria, reserva.usuarios, reserva.configuracoes',
      );
    }
    // O arquivo tem o próprio "begin; ... commit;": o begin interno só gera um aviso
    // e o commit final confirma tudo de uma vez.
    await client.query(conteudo);
  } catch (error) {
    await client.query('rollback').catch(() => undefined);
    throw error;
  }
  return cabecalho;
}
