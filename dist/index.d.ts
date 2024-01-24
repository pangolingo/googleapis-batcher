import { GaxiosOptions } from 'gaxios';

type FetchImplementation = Required<GaxiosOptions>['fetchImplementation'];
declare const signalSymbol: unique symbol;
interface BatchSchedulerSignal {
    readonly __tag: typeof signalSymbol;
    schedule: () => void;
    onSchedule: (cb: () => void) => void;
}
declare const makeBatchSchedulerSignal: () => BatchSchedulerSignal;
interface BatchOptions {
    maxBatchSize?: number;
    batchWindowMs?: number;
    signal?: BatchSchedulerSignal;
}

declare function batchFetchImplementation(options?: BatchOptions): FetchImplementation;

export { batchFetchImplementation, makeBatchSchedulerSignal };
