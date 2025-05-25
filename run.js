import { runIt, hackThePlanet  } from "sjs1985/utils.js"

/** @param {NS} ns */
/** @param {import(".").NS } ns */

export async function main(ns) {
  await hackThePlanet(ns)
  await runIt(ns, "sjs1985/core/UI.js", true, [])
}