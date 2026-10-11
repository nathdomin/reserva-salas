import {
  CalendarDays,
  ClipboardList,
  DoorOpen,
  House,
  ListChecks,
  ScrollText,
  Settings,
  Users,
  type LucideIcon,
} from 'lucide-react';

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  end?: boolean;
}

export interface NavSection {
  label?: string;
  /** Seção visível só para administradores (a API também bloqueia o acesso). */
  somenteAdmin?: boolean;
  items: NavItem[];
}

export const NAV_SECTIONS: NavSection[] = [
  {
    items: [
      { to: '/', label: 'Início', icon: House, end: true },
      { to: '/calendario', label: 'Calendário', icon: CalendarDays },
      { to: '/minhas-reservas', label: 'Minhas reservas', icon: ClipboardList },
    ],
  },
  {
    label: 'Administração',
    somenteAdmin: true,
    items: [
      { to: '/admin/reservas', label: 'Reservas', icon: ListChecks },
      { to: '/admin/salas', label: 'Salas', icon: DoorOpen },
      { to: '/admin/usuarios', label: 'Usuários', icon: Users },
      { to: '/admin/auditoria', label: 'Histórico de alterações', icon: ScrollText },
      { to: '/admin/configuracoes', label: 'Configurações', icon: Settings },
    ],
  },
];
