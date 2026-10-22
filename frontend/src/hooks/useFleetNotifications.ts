import {
  useCallback,
  useEffect,
  useState,
} from 'react';

import type {
  IncidentDTO as Incident,
} from '../../../shared/contracts/incidents';

export type Notice = {
  incident: Incident;
  onRoute: boolean;
};

export function useFleetNotifications(
  onReported: (incident: Incident) => void,
) {
  const [notices, setNotices] = useState<Notice[]>([]);
  const [toast, setToast] = useState<Notice | null>(null);

  const notify = useCallback(
    (incident: Incident, onRoute: boolean) => {
      const notice = { incident, onRoute };

      onReported(incident);

      setNotices(
        (items) => [
          notice,
          ...items.filter(
            (item) => item.incident.id !== incident.id,
          ),
        ].slice(0, 8),
      );

      setToast(notice);
    },
    [onReported],
  );

  // La notificación dura ocho segundos reales de pantalla.
  // No depende de la velocidad del reloj del escenario.
  useEffect(() => {
    if (!toast) return;

    const timer = window.setTimeout(
      () => setToast(null),
      8000,
    );

    return () => window.clearTimeout(timer);
  }, [toast]);

  return {
    notices,
    toast,
    notify,
    dismiss: () => setToast(null),
  };
}
