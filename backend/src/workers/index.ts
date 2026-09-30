import { startGeocoderWorker, stopGeocoderWorker } from './geocoder.worker';
import { startVroomWorker, stopVroomWorker } from './vroom.worker';
import { startPyvrpWorker, stopPyvrpWorker } from './pyvrp.worker';
import { startDneSyncWorker, stopDneSyncWorker } from './dne-sync.worker';
import { startNpsNotifyWorker, stopNpsNotifyWorker } from './nps-notify.worker';
import { startEntregasRastreioWorker, stopEntregasRastreioWorker } from './entregas-rastreio.worker';

export function startWorkers(): void {
  startGeocoderWorker();
  startVroomWorker();
  startPyvrpWorker();
  startDneSyncWorker();
  startNpsNotifyWorker();
  startEntregasRastreioWorker();
}

export async function stopWorkers(): Promise<void> {
  await Promise.all([
    stopGeocoderWorker(),
    stopVroomWorker(),
    stopPyvrpWorker(),
    stopDneSyncWorker(),
    stopNpsNotifyWorker(),
    stopEntregasRastreioWorker(),
  ]);
}
