export const hackReady = true
/** @param {NS} ns */
export async function main(ns) {
  if (!ns.args[1]) await ns.hack(ns.args[0])
  else await ns.hack(ns.args[0], { additionalMsec: ns.args[1] })
  //ns.tprintf("Hack")
}