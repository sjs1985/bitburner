/** @param {NS} ns */
export async function main(ns) {
  
  const port = ns.getPortHandle(ns.pid)
  const result = ns.getScriptRam(ns.args[0], "home")
  ns.atExit(() => port.write(result))
}