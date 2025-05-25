// Keep this much free for temp scripts to run on home first
export const homeReservedRam = 64

export async function ramDodge(ns, scriptName, persistent, argmts) {
  const pidof = await runIt(ns, scriptName, persistent, argmts);
  const port = ns.getPortHandle(pidof);
  await port.nextWrite();
  return port.read();
}

export async function ramDodgeLocal(ns, scriptName, argmts) {
  const pidof = ns.exec(scriptName, "home", { threads: 1, temporary: true }, ...argmts)
  const port = ns.getPortHandle(pidof);
  await port.nextWrite();
  return port.read();
}

/** @param {NS} ns */
export async function runIt(ns, script, persistent, argmts) {
  //Any runIt now has a persistent argument to pass along if it can run on hacknet servers.
  //This way you can choose to run something like puppet on a hacknet server
  let thispid = 0
  let threads = 1
  /**@type {String[]} servers */
  const servers = await getServersLight(ns)
  let scriptRam = await doGetScriptRam(ns, script)
  if (scriptRam == 0) { // had some issues with first call returning 0, so we call again
    scriptRam = await doGetScriptRam(ns, script)
  }

  for (const server of servers) {
    if (!await getHasRootAccess(ns, server)) continue
    if ((server.startsWith("hacknet") && persistent)) continue
    let tmpramavailable = await getServerAvailableRam(ns, server)

    if (server.startsWith("home") && persistent) tmpramavailable = Math.max(tmpramavailable - homeReservedRam, 0)
    const threadsonserver = Math.floor(tmpramavailable / scriptRam)
    // How many threads can we run?  If we can run something, do it
    if (threadsonserver <= 0) continue
    await doSCP(ns, script, server)

    thispid = ns.exec(script, server, { threads: 1, temporary: true }, ...argmts)
    if (thispid === 0) continue
    threads--
    break
  }// All servers
  if (threads >= 1) ns.tprintf("Failed to allocate all threads for script: %s", script)
  return thispid
}

export async function maxRun(ns, persistent, useHacknet = false) {
  //Any runIt now has a persistent argument to pass along if it can run on hacknet servers.
  //This way you can choose to run something like puppet on a hacknet server
  let highest = 0
  /**@type {String[]} servers */
  const servers = await getServersLight(ns)
  let emergencyReserve = await getServerAvailableRam(ns, "home") <= 16 ? true : false
  for (const server of servers) {
    if (!await getHasRootAccess(ns, server)) continue
    if ((server.startsWith("hacknet") && !useHacknet)) continue
    let tmpramavailable = await getServerAvailableRam(ns, server)
    if (server === "home" && persistent) tmpramavailable = Math.max(tmpramavailable - reservedRam, 0)
    if (tmpramavailable > highest)
      highest = tmpramavailable
  }// All servers
  if (!persistent) return highest
  //Highest is now max run
  const resRam = highest >= 256 ? 256 : highest >= 128 ? 128 : highest >= 64 ? 64 : highest >= 32 ? 32 : 16
  //Now that we have the highest, we go again
  let highest2 = 0
  for (const server of servers) {
    if (!await getHasRootAccess(ns, server)) continue
    if ((server.startsWith("hacknet") && persistent)) continue
    let tmpramavailable = await getServerAvailableRam(ns, server)
    if (persistent && emergencyReserve && tmpramavailable >= resRam) {
      emergencyReserve = false
      tmpramavailable -= resRam
    }
    if (server === "home" && persistent) tmpramavailable = Math.max(tmpramavailable - reservedRam, 0)
    if (tmpramavailable > highest2)
      highest2 = tmpramavailable
  }// All servers
  return highest2
}

export function printProfit(ns, tm, take, batches, threads, chance) {
  //tm is in milliseconds...
  tm = tm / 1000
  //Profit per second
  let profit = (take / tm) * batches
  profit = profit / threads * chance
  return tm === 0 || take === 0 || isNaN(profit) ? 0 : profit
}

export function profitPerSecond(ns, tm, take, batches) {
  //tm is in milliseconds...
  tm = tm / 1000
  //Profit per second
  let profit = (take / tm) * batches
  return tm === 0 || take === 0 || isNaN(profit) ? "0" + "/s" : (ns.formatNumber(profit, 2) + "/s")
}

export async function hackThePlanet(ns) { return await ramDodgeLocal(ns, "sjs1985/core/hackThePlanet.js", []) }
export async function getServersLight(ns) { return await ramDodgeLocal(ns, "sjs1985/dodge/getServersLight.js", []) }
export async function getServers(ns) { return await ramDodge(ns, "sjs1985/dodge/getServers.js", false, []) }
export async function getSrvr(ns, hostname) { return await ramDodge(ns, "sjs1985/dodge/getServer.js", false, [hostname]) }
export async function getHasRootAccess(ns, hostname) { return await ramDodgeLocal(ns, "sjs1985/dodge/getHasRootAccess.js", [hostname]) }
export async function doSCP(ns, script, hostname) { return await ramDodgeLocal(ns, "sjs1985/dodge/doSCP.js", [script, hostname]) }
export async function doGetScriptRam(ns, scriptname) { return await ramDodgeLocal(ns, "sjs1985/dodge/getScriptRam.js", [scriptname]) }
export async function getServerAvailableRam(ns, hostname) { return await ramDodgeLocal(ns, "sjs1985/dodge/getServerAvailableRam.js", [hostname]) }
export async function getPlayer(ns) { return await ramDodgeLocal(ns, "sjs1985/dodge/getPlayer.js", []) }
export async function getResetInfo(ns) { return await ramDodge(ns, "sjs1985/dodge/getResetInfo.js", false, []) }
export async function getOwnedSF(ns) { return await ramDodge(ns, "sjs1985/singularity/getOwnedSF.js", false, []) }
export async function wastePids(ns) { return await ramDodge(ns, "sjs1985/dodge/wastePids.js", false, []) }
export async function doKill(ns, pidnum) { return await ramDodge(ns, "sjs1985/dodge/kill.js", false, [pidnum]) }
export async function getOptimalTarget(ns) { return await ramDodge(ns, "sjs1985/core/getOptimalTarget.js", false, []) }
export async function getHackP(ns, target, batches, threadsavailable, starthack) { return await ramDodge(ns, "sjs1985/core/getHackP.js", false, [target, batches, threadsavailable, starthack]) }
export async function weakenStr(ns) { return await ramDodge(ns, "sjs1985/dodge/weakenStr.js", false, []) }
export async function getGrowThreads(ns, hostname, moneystate, minsecurity) { return await ramDodge(ns, "sjs1985/core/getGrowThreads.js", false, [hostname, moneystate, minsecurity]) }
export async function getHckTimeBasic(ns, hostname) { return await ramDodge(ns, "sjs1985/dodge/getHackTime.js", false, [hostname]) }
export async function getIsRunning(ns, pidnumber) { return await ramDodgeLocal(ns, "sjs1985/dodge/getIsRunning.js", [pidnumber]) }
export async function doGetServerCurSec(ns, hostname) { return await ramDodge(ns, "sjs1985/dodge/doGetServerCurSec.js", false, [hostname]) }
export async function doGetServerMinSec(ns, hostname) { return await ramDodge(ns, "sjs1985/dodge/doGetServerMinSec.js", false, [hostname]) }
export async function serverPurchaser(ns) { return await ramDodge(ns, "sjs1985/core/serverPurchaser.js", false, []) }
export async function serverRun(ns, target, w1, g1, w2, h1, w3, g2, w4, batchh1, batchw1, batchg1, batchw2, batches, nohacknet) { return await ramDodgeLocal(ns, "sjs1985/core/serverRun.js", [target, w1, g1, w2, h1, w3, g2, w4, batchh1, batchw1, batchg1, batchw2, batches, nohacknet]) }
export async function getPortOpeners(ns) { return await ramDodge(ns, "sjs1985/dodge/getPortOpeners.js", false, []) }
export async function hashIt(ns, type) { return await ramDodge(ns, "sjs1985/core/hashIt.js", false, [type]) }
export async function getPortOpenersSing(ns) { return await ramDodge(ns, "sjs1985/singularity/getPortOpenersSing.js", false, []) }
export async function hasBN(ns, bn, lvl = 1) { return await ramDodge(ns, "sjs1985/dodge/hasBN.js", false, [bn, lvl]) }
export async function hacknetPurchaser(ns) { return await ramDodge(ns, "sjs1985/core/hacknetPurchaser.js", false, []) }
export async function upgHomeRam(ns) { return await ramDodge(ns, "sjs1985/singularity/upgradeHomeRam.js", false, []) }


/*

export async function doSCP(ns, script, hostname) { return await ramDodgeLocal(ns, "SphyxOS/basic/doSCP.js", [script, hostname]) }
export async function getHasRootAccess(ns, hostname) { return await ramDodgeLocal(ns, "SphyxOS/basic/getHasRootAccess.js", [hostname]) }

export async function getMoneyAvailable(ns, hostname) { return await ramDodgeLocal(ns, "SphyxOS/basic/getMoneyAvailable.js", [hostname]) }
export async function getIsRunning(ns, pidnumber) { return await ramDodgeLocal(ns, "SphyxOS/basic/getIsRunning.js", [pidnumber]) }
export async function serverRun(ns, target, w1, g1, w2, h1, w3, g2, w4, batchh1, batchw1, batchg1, batchw2, batches, nohacknet) { return await ramDodgeLocal(ns, "SphyxOS/extras/serverRun.js", [target, w1, g1, w2, h1, w3, g2, w4, batchh1, batchw1, batchg1, batchw2, batches, nohacknet]) }

export async function getSrvr(ns, hostname) { return await ramDodge(ns, "SphyxOS/basic/getServer.js", false, [hostname]) }
export async function getHckTimeBasic(ns, hostname) { return await ramDodge(ns, "SphyxOS/basic/getHackTime.js", false, [hostname]) }

export async function doScriptKill(ns, script, server) { return await ramDodge(ns, "SphyxOS/basic/scriptKill.js", false, [script, server]) }
export async function hasBN(ns, bn, lvl = 1) { return await ramDodge(ns, "SphyxOS/extras/hasBN.js", false, [bn, lvl]) }
export async function currentBN(ns) { return await ramDodge(ns, "SphyxOS/extras/currentBN.js", false, []) }
export async function getBNMults(ns) { return await ramDodge(ns, "SphyxOS/basic/getbnmults.js", false, []) }
export async function getMoneySource(ns) { return await ramDodge(ns, "SphyxOS/basic/getMoneySources.js", false, []) }
export async function wastePids(ns) { return await ramDodge(ns, "SphyxOS/extras/wastePids.js", false, []) }
export async function getResetInf(ns) { return await ramDodge(ns, "SphyxOS/basic/getResetInfo.js", false, []) }
export async function getOptimalTarget(ns) { return await ramDodge(ns, "SphyxOS/extras/getOptimalTarget.js", false, []) }
export async function getHackP(ns, target, batches, threadsavailable, starthack) { return await ramDodge(ns, "SphyxOS/extras/getHackP.js", false, [target, batches, threadsavailable, starthack]) }
export async function getPlay(ns) { return await ramDodge(ns, "SphyxOS/basic/getPlay.js", false, []) }
export async function weakenStr(ns) { return await ramDodge(ns, "SphyxOS/basic/weakenStr.js", false, []) }
export async function getHackPercent(ns, hostname, minsecurity) { return await ramDodge(ns, "SphyxOS/forms/getHackPercent.js", false, [hostname, minsecurity]) }
export async function getHackChance(ns, hostname, minsecurity) { return await ramDodge(ns, "SphyxOS/forms/getHackChance.js", false, [hostname, minsecurity]) }
export async function getHckTime(ns, hostname, minsecurity) { return await ramDodge(ns, "SphyxOS/forms/getHckTime.js", false, [hostname, minsecurity]) }
export async function getGrowThreads(ns, hostname, moneystate, minsecurity) { return await ramDodge(ns, "SphyxOS/forms/getGrowThreads.js", false, [hostname, moneystate, minsecurity]) }
export async function getReputationFromDonation(ns, amount) { return await ramDodge(ns, "SphyxOS/forms/getReputationFromDonation.js", false, [amount]) }
export async function doGetServerMinSec(ns, hostname) { return await ramDodge(ns, "SphyxOS/basic/doGetServerMinSec.js", false, [hostname]) }
export async function doGetServerCurSec(ns, hostname) { return await ramDodge(ns, "SphyxOS/basic/doGetServerCurSec.js", false, [hostname]) }
export async function doGetServerMaxMoney(ns, hostname) { return await ramDodge(ns, "SphyxOS/basic/doGetServerMaxMoney.js", false, [hostname]) }
export async function doGetHostname(ns) { return await ramDodge(ns, "SphyxOS/basic/getHostname.js", false, []) }
export async function hashIt(ns, type) { return await ramDodge(ns, "SphyxOS/extras/hashIt.js", false, [type]) }
export async function virus(ns) { return await ramDodge(ns, "SphyxOS/extras/virus.js", false, []) }
export async function serverPurchaser(ns) { return await ramDodge(ns, "SphyxOS/extras/serverPurchaser.js", false, []) }
export async function hacknetPurchaser(ns) { return await ramDodge(ns, "SphyxOS/bins/hacknetPurchaser.js", false, []) }
export async function getPortOpeners(ns) { return await ramDodge(ns, "SphyxOS/extras/getPortOpeners.js", false, []) }
export async function getPortOpenersSing(ns) { return await ramDodge(ns, "SphyxOS/extras/getPortOpenersSing.js", false, []) }
export async function doKill(ns, pidnum) { return await ramDodge(ns, "SphyxOS/basic/kill.js", false, [pidnum]) }
*/

/** @param {NS} ns */
export async function main(ns) {
}