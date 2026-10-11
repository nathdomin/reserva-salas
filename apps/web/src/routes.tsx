import { Navigate, type RouteObject } from 'react-router';
import { RequireAdmin, RequireAuth } from './components/auth/guards';
import { AppLayout } from './components/layout/AppLayout';
import { AdminReservationsPage } from './pages/admin/AdminReservationsPage';
import { AuditPage } from './pages/admin/AuditPage';
import { RoomsPage } from './pages/admin/RoomsPage';
import { SettingsPage } from './pages/admin/SettingsPage';
import { UsersPage } from './pages/admin/UsersPage';
import { CalendarPage } from './pages/CalendarPage';
import { EditReservationPage } from './pages/EditReservationPage';
import { HomePage } from './pages/HomePage';
import { LoginPage } from './pages/LoginPage';
import { MinhaContaPage } from './pages/MinhaContaPage';
import { MyReservationsPage } from './pages/MyReservationsPage';
import { NewReservationPage } from './pages/NewReservationPage';
import { NotFoundPage } from './pages/NotFoundPage';
import { ReservationDetailPage } from './pages/ReservationDetailPage';

/*
 * As guardas abaixo cuidam só da experiência de uso (levar ao login, esconder a área
 * administrativa). Quem realmente protege os dados é a API, que valida sessão e perfil
 * em todas as rotas.
 */
export const routes: RouteObject[] = [
  { path: '/login', element: <LoginPage /> },
  {
    element: <RequireAuth />,
    children: [
      {
        element: <AppLayout />,
        children: [
          { index: true, element: <HomePage /> },
          { path: 'calendario', element: <CalendarPage /> },
          { path: 'minhas-reservas', element: <MyReservationsPage /> },
          { path: 'reservas/nova', element: <NewReservationPage /> },
          { path: 'reservas/:id', element: <ReservationDetailPage /> },
          { path: 'reservas/:id/editar', element: <EditReservationPage /> },
          { path: 'minha-conta', element: <MinhaContaPage /> },
          {
            path: 'admin',
            element: <RequireAdmin />,
            children: [
              { index: true, element: <Navigate to="reservas" replace /> },
              { path: 'reservas', element: <AdminReservationsPage /> },
              { path: 'salas', element: <RoomsPage /> },
              { path: 'usuarios', element: <UsersPage /> },
              { path: 'auditoria', element: <AuditPage /> },
              { path: 'configuracoes', element: <SettingsPage /> },
            ],
          },
          { path: '*', element: <NotFoundPage /> },
        ],
      },
    ],
  },
];
