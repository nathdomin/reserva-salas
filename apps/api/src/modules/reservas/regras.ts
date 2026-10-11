import {
  emMinutos,
  hojeNoFuso,
  paraHora,
  paraInstante,
  partesNoFuso,
  somarDias,
  type Configuracoes,
  type ReservaInput,
} from '@reserva/shared';

export interface ErroCampo {
  campo: string;
  mensagem: string;
}

export interface Periodo {
  inicio: Date;
  fim: Date;
  horaInicio: string;
  horaFim: string;
}

export type ResultadoPeriodo = ({ ok: true } & Periodo) | { ok: false; erros: ErroCampo[] };

/** Arredonda para baixo até o início do intervalo atual (ex.: 10:07 → 10:00 com passo de 15). */
export function inicioDoIntervaloAtual(agora: Date, passoMinutos: number): Date {
  const passoMs = passoMinutos * 60_000;
  return new Date(Math.floor(agora.getTime() / passoMs) * passoMs);
}

/**
 * Valida data e horário de uma reserva conforme as configurações e devolve o período em
 * instantes absolutos. `verificarPassado` é desligado quando uma edição não muda o horário.
 */
export function validarPeriodo(
  input: Pick<ReservaInput, 'data' | 'diaInteiro' | 'horaInicio' | 'horaFim'>,
  config: Configuracoes,
  agora: Date,
  opcoes: { verificarPassado: boolean } = { verificarPassado: true },
): ResultadoPeriodo {
  const erros: ErroCampo[] = [];
  const g = config.granularidadeMinutos;
  const abertura = config.horarioInicio.slice(0, 5);
  const fechamento = config.horarioFim.slice(0, 5);
  const hoje = hojeNoFuso(agora);
  const limiteInferior = inicioDoIntervaloAtual(agora, g);

  let horaInicio = input.diaInteiro ? abertura : (input.horaInicio ?? '');
  const horaFim = input.diaInteiro ? fechamento : (input.horaFim ?? '');

  // "Dia inteiro" hoje, com o expediente já começado: reserva o restante do dia.
  if (input.diaInteiro && opcoes.verificarPassado && input.data === hoje) {
    const agoraNoIntervalo = partesNoFuso(limiteInferior).hora;
    if (emMinutos(agoraNoIntervalo) > emMinutos(abertura)) horaInicio = agoraNoIntervalo;
    if (emMinutos(horaInicio) >= emMinutos(fechamento)) {
      return {
        ok: false,
        erros: [{ campo: 'data', mensagem: 'O horário de funcionamento de hoje já terminou.' }],
      };
    }
  }

  if (!horaInicio || !horaFim) {
    return { ok: false, erros: [{ campo: 'horaInicio', mensagem: 'Informe o horário.' }] };
  }

  const ini = emMinutos(horaInicio);
  const fim = emMinutos(horaFim);

  if (!input.diaInteiro && (ini % g !== 0 || fim % g !== 0)) {
    erros.push({
      campo: ini % g !== 0 ? 'horaInicio' : 'horaFim',
      mensagem: `Use horários de ${g} em ${g} minutos (ex.: 09:00, ${paraHora(9 * 60 + g)}).`,
    });
  }
  if (fim <= ini) {
    erros.push({ campo: 'horaFim', mensagem: 'O término deve ser depois do início.' });
  }
  if (ini < emMinutos(abertura) || fim > emMinutos(fechamento)) {
    erros.push({
      campo: ini < emMinutos(abertura) ? 'horaInicio' : 'horaFim',
      mensagem: `As reservas são permitidas das ${abertura} às ${fechamento}.`,
    });
  }
  if (!input.diaInteiro && fim > ini) {
    const duracao = fim - ini;
    if (duracao < config.duracaoMinimaMinutos) {
      erros.push({
        campo: 'horaFim',
        mensagem: `A reunião deve durar pelo menos ${config.duracaoMinimaMinutos} minutos.`,
      });
    }
    if (duracao > config.duracaoMaximaMinutos) {
      const horas = config.duracaoMaximaMinutos / 60;
      erros.push({
        campo: 'horaFim',
        mensagem: `A reunião pode durar no máximo ${Number.isInteger(horas) ? `${horas} horas` : `${config.duracaoMaximaMinutos} minutos`}. Para o dia todo, marque "Dia inteiro".`,
      });
    }
  }

  const ultimaData = somarDias(hoje, config.antecedenciaMaximaDias);
  if (input.data > ultimaData) {
    erros.push({
      campo: 'data',
      mensagem: `Reservas podem ser feitas com até ${config.antecedenciaMaximaDias} dias de antecedência.`,
    });
  }

  if (erros.length > 0) return { ok: false, erros };

  const inicio = paraInstante(input.data, horaInicio);
  const termino = paraInstante(input.data, horaFim);

  if (opcoes.verificarPassado && inicio < limiteInferior) {
    return {
      ok: false,
      erros: [
        {
          campo: input.data < hoje ? 'data' : 'horaInicio',
          mensagem: 'Não é possível reservar um horário que já passou.',
        },
      ],
    };
  }

  return { ok: true, inicio, fim: termino, horaInicio, horaFim };
}

export interface Intervalo {
  inicio: Date;
  fim: Date;
}

/**
 * Horários livres na mesma sala e no mesmo dia, com a mesma duração do pedido.
 * Devolve os mais próximos do horário desejado, em ordem cronológica.
 */
export function sugerirHorarios(params: {
  data: string;
  horaDesejada: string;
  duracaoMinutos: number;
  ocupados: Intervalo[];
  config: Configuracoes;
  agora: Date;
  limite?: number;
}): { horaInicio: string; horaFim: string }[] {
  const { data, duracaoMinutos, ocupados, config, agora } = params;
  const g = config.granularidadeMinutos;
  const folgaMs = config.intervaloEntreReunioesMinutos * 60_000;
  const abertura = emMinutos(config.horarioInicio);
  const fechamento = emMinutos(config.horarioFim);
  const desejado = emMinutos(params.horaDesejada);
  const minimo = inicioDoIntervaloAtual(agora, g);

  const candidatos: { horaInicio: string; horaFim: string; distancia: number }[] = [];
  for (let t = Math.ceil(abertura / g) * g; t + duracaoMinutos <= fechamento; t += g) {
    const horaInicio = paraHora(t);
    const horaFim = paraHora(t + duracaoMinutos);
    const inicio = paraInstante(data, horaInicio);
    const fim = paraInstante(data, horaFim);
    if (inicio < minimo) continue;
    const livre = ocupados.every(
      (o) =>
        !(
          inicio.getTime() < o.fim.getTime() + folgaMs &&
          fim.getTime() + folgaMs > o.inicio.getTime()
        ),
    );
    if (livre) candidatos.push({ horaInicio, horaFim, distancia: Math.abs(t - desejado) });
  }

  // Alterna opções antes e depois do horário pedido (a mais próxima primeiro), para a
  // pessoa ter escolhas dos dois lados em vez de várias seguidas do mesmo lado.
  const porDistancia = (a: { distancia: number }, b: { distancia: number }) =>
    a.distancia - b.distancia;
  const antes = candidatos.filter((c) => emMinutos(c.horaInicio) < desejado).sort(porDistancia);
  const depois = candidatos.filter((c) => emMinutos(c.horaInicio) >= desejado).sort(porDistancia);
  const escolhidos: typeof candidatos = [];
  const limite = params.limite ?? 5;
  let vezDeAntes = (antes[0]?.distancia ?? Infinity) < (depois[0]?.distancia ?? Infinity);
  while (escolhidos.length < limite && (antes.length > 0 || depois.length > 0)) {
    const fila = vezDeAntes
      ? antes.length > 0
        ? antes
        : depois
      : depois.length > 0
        ? depois
        : antes;
    escolhidos.push(fila.shift()!);
    vezDeAntes = !vezDeAntes;
  }

  return escolhidos
    .sort((a, b) => emMinutos(a.horaInicio) - emMinutos(b.horaInicio))
    .map(({ horaInicio, horaFim }) => ({ horaInicio, horaFim }));
}
