/**
 * The DB-graph gate.
 *
 * `logseq.App.checkCurrentIsDbGraph()` answers `false` while the graph is still
 * loading — measured 9ms after `logseq.ready` on a start where the DB graph did
 * exist, with `getCurrentGraph()` still `null`. A first falsy answer is
 * therefore not evidence of a file graph, only of a graph that has not arrived,
 * so the answer is re-asked until a graph is actually loaded.
 */

/** What a probe of the host says: no graph yet, a DB graph, or a file graph. */
export type GraphSupport = 'unknown' | 'db' | 'file'

/** A decided answer — a graph is loaded, so its kind is known. */
export type DecidedGraphSupport = Exclude<GraphSupport, 'unknown'>

export function classifyGraph(
  graph: unknown,
  isDbGraph: boolean,
): GraphSupport {
  if (graph === null || graph === undefined) return 'unknown'
  return isDbGraph ? 'db' : 'file'
}

export interface GraphGate {
  /** Resolves the first time a probe finds a loaded graph. */
  decided: Promise<DecidedGraphSupport>
  /** Ask again; probes never overlap, and stop once the answer is decided. */
  recheck(): void
}

export function createGraphGate(probe: () => Promise<GraphSupport>): GraphGate {
  let settle: (support: DecidedGraphSupport) => void = () => {}
  const decided = new Promise<DecidedGraphSupport>((resolve) => {
    settle = resolve
  })
  let done = false
  let inFlight = false

  return {
    decided,
    recheck() {
      if (done || inFlight) return
      inFlight = true
      void probe()
        .then(
          (support) => {
            if (support === 'unknown') return
            done = true
            settle(support)
          },
          // A probe that fails answers nothing; the next recheck asks again.
          () => {},
        )
        .finally(() => {
          inFlight = false
        })
    },
  }
}
