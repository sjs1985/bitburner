import { homeReservedRam } from "sjs1985/utils.js"
/**@type {String[]} servers */
let servers;
/**@type {String[]} batchServers */
let batchServers;
/** @param {NS} ns */
let max;
export async function main(ns) {
  const target = ns.args[0]
  const w1 = ns.args[1]
  const g1 = ns.args[2]
  const w2 = ns.args[3]
  const h1 = ns.args[4]
  const w3 = ns.args[5]
  const g2 = ns.args[6]
  const w4 = ns.args[7]
  const batchh1 = ns.args[8]
  const batchw1 = ns.args[9]
  const batchg1 = ns.args[10]
  const batchw2 = ns.args[11]
  const batches = ns.args[12]
  const nohacknet = ns.args[13]
  servers = getServers(ns, nohacknet)
  batchServers = getServers(ns, nohacknet)
  let results;
  const hacktime = ns.getHackTime(target)
  const growtime = ns.getGrowTime(target)
  const weaktime = ns.getWeakenTime(target)
  let recalc = false
  let chunkswitch1 = false
  let chunkswitch2 = false
  max = maxRun(ns, false, !nohacknet)
  //Run the wave!
  chunkswitch1 = check_batch(ns, w1, g1, w2, h1, w3, g2, w4, nohacknet)
  let starttime = performance.now()
  if (w1) results = runIt_Local(ns, "sjs1985/core/weaken.js", [target, 0, w1, false, nohacknet])
  if (g1) results = runIt_Local(ns, "sjs1985/core/grow.js", [target, weaktime - growtime, g1, chunkswitch1, nohacknet])
  if (w2) results = runIt_Local(ns, "sjs1985/core/weaken.js", [target, 0, w2, false, nohacknet])
  if (h1) results = runIt_Local(ns, "sjs1985/core/hack.js", [target, weaktime - hacktime, h1, chunkswitch1, nohacknet])
  if (w3) results = runIt_Local(ns, "sjs1985/core/weaken.js", [target, 0, w3, false, nohacknet])
  if (g2) results = runIt_Local(ns, "sjs1985/core/grow.js", [target, weaktime - growtime, g2, chunkswitch1, nohacknet])
  if (w4) results = runIt_Local(ns, "sjs1985/core/weaken.js", [target, 0, w4, false, nohacknet])

  let batchesrun = 0
  for (let i = 1; i <= Math.min(batches, 99999); i++) {
    if (starttime + weaktime <= performance.now()) { //The performance wall
      recalc = true
      break
    }
    if (i === 99999) recalc = true

    batchesrun++
    chunkswitch2 = check_batch(ns, 0, 0, 0, batchh1, batchw1, batchg1, batchw2, nohacknet)
    if (batchh1) results = runIt_Local(ns, "sjs1985/core/hack.js", [target, weaktime - hacktime, batchh1, chunkswitch2, nohacknet])
    if (batchw1) results = runIt_Local(ns, "sjs1985/core/weaken.js", [target, 0, batchw1, false, nohacknet])
    if (batchg1) results = runIt_Local(ns, "sjs1985/core/grow.js", [target, weaktime - growtime, batchg1, chunkswitch2, nohacknet])
    if (batchw2) results = runIt_Local(ns, "sjs1985/core/weaken.js", [target, 0, batchw2, false, nohacknet])

    if (i % 2000 === 0) { // Reduce down for a smother experience
      await ns.sleep(0)
    }
  }


  const record = {
    "lastpid": results,
    "recalc": recalc,
    "batches": batchesrun,
    "batching": chunkswitch1 && chunkswitch2
  }
  const port = ns.getPortHandle(ns.pid)
  ns.atExit(() => port.write(record))
}
/** @param {NS} ns */
function runIt_Local(ns, script, argmts) {//target, sleeptm, threads, chunks, opt) {
  const target = argmts[0]
  const sleeptm = argmts[1]
  let threads = argmts[2]
  const chunks = argmts[3]
  const nohacknet = argmts[4]
  let thispid = 0
  const serversRemove = []
  let emergencyReserve = ns.getServerMaxRam("home") <= 16 ? true : false
  const resRam = max >= 256 ? 256 : max >= 128 ? 128 : max >= 64 ? 64 : max >= 32 ? 32 : 16

  for (const server of servers) {
    let tmpramavailable = ns.getServerMaxRam(server) - ns.getServerUsedRam(server)
    if (server === "hacknet" && nohacknet) continue
    if (server === "home") tmpramavailable = Math.max(tmpramavailable - homeReservedRam, 0) //Reserve home ram for smaller things
    //Reserve our home threads
    let threadsonserver = Math.floor(tmpramavailable / 1.75)
    if (threadsonserver <= 0) {
      serversRemove.push(server)
      continue
    }
    if (emergencyReserve && tmpramavailable >= resRam) {
      emergencyReserve = false
      tmpramavailable -= resRam
    } //Reserve if home ram is 16GB or less
    if (chunks) { //We NEED enough to finish the whole operation at once
      if (threadsonserver >= threads) {
        thispid = ns.exec(script, server, { threads: threads, temporary: true }, target, sleeptm, "QUIET")
        if (thispid === 0) ns.tprintf("Failed to run: %s on %s threads:%s target:%s", script, server, threads, target)
        threads = 0
        break
      }
    } // chunks
    else {
      if (threadsonserver >= threads) { //We have enough to finish it off
        thispid = ns.exec(script, server, { threads: threads, temporary: true }, target, sleeptm, "QUIET")
        if (thispid === 0) ns.tprintf("Failed to run: %s on %s threads:%s target:%s", script, server, threads, target)
        threads = 0
        break
      }
      else { //We have threads but not enough     
        thispid = ns.exec(script, server, { threads: threadsonserver, temporary: true }, target, sleeptm, "QUIET")
        if (thispid === 0) ns.tprintf("Failed to run: %s on %s threads:%s target:%s", script, server, threads, target)
        threads -= threadsonserver
        threadsonserver = 0
      }
    }//No chunks
  }// All servers
  if (threads > 0) ns.tprintf("Failed to allocate all %s threads. %s left.  Chunk: %s  Error!", script, threads, chunks)
  servers = servers.filter((f) => !serversRemove.includes(f))
  return thispid
}

/** @param {NS} ns */
function getServers(ns, nohacknet) {
  const serverList = new Set(["home"])
  for (const server of serverList) {
    for (const connection of ns.scan(server)) {
      serverList.add(connection)
    }
  }

  const serverDetails = []
  for (const server of serverList) {
    if (!ns.hasRootAccess(server) || ns.getServerMaxRam(server) <= 0) continue
    if (server.startsWith("hacknet") && nohacknet) continue
    serverDetails.push(server)
  }
  serverDetails.sort((a, b) => { return (ns.getServerMaxRam(a) - ns.getServerUsedRam(a)) - (ns.getServerMaxRam(b) - ns.getServerUsedRam(b)) })

  return serverDetails
}
/** @param {NS} ns */
export async function maxRun(ns, persistent) {
  //Any runIt now has a persistent argument to pass along if it can run on hacknet servers.
  //This way you can choose to run something like puppet on a hacknet server
  let highest = 0
  /**@type {String[]} servers */
  const servers = getServers(ns)
  let emergencyReserve = ns.getServerMaxRam("home") <= 16 ? true : false
  for (const server of servers) {
    if (!ns.hasRootAccess(server)) continue
    if ((server.startsWith("hacknet") && persistent)) continue
    let tmpramavailable = ns.getServerMaxRam(server) - ns.getServerUsedRam(server)
    if (server === "home" && persistent) tmpramavailable = Math.max(tmpramavailable - homeReservedRam, 0)
    if (tmpramavailable > highest)
      highest = tmpramavailable
  }// All servers
  if (!persistent) return highest
  //Highest is now max run
  const resRam = highest >= 256 ? 256 : highest >= 128 ? 128 : highest >= 64 ? 64 : highest >= 32 ? 32 : 16
  //Now that we have the highest, we go again
  let highest2 = 0
  for (const server of servers) {
    if (!ns.hasRootAccess(server)) continue
    if ((server.startsWith("hacknet") && persistent)) continue
    let tmpramavailable = ns.getServerMaxRam(server) - ns.getServerUsedRam(server)
    if (persistent && emergencyReserve && tmpramavailable >= resRam) {
      emergencyReserve = false
      tmpramavailable -= resRam
    }
    if (server === "home" && persistent) tmpramavailable = Math.max(tmpramavailable - homeReservedRam, 0)
    if (tmpramavailable > highest2)
      highest2 = tmpramavailable
  }// All servers
  return highest2
}

/** @param {NS} ns */
function check_batch(ns, w1, g1, w2, h1, w3, g2, w4, noHacknet, checklist = []) {
  //Nothing has been started up yet.  Base servers have all the values we need.
  //Our test cases.  One for each possible worker type
  let w1test = false
  let g1test = false
  let w2test = false
  let h1test = false
  let w3test = false
  let g2test = false
  let w4test = false
  const startcount = w1 + g1 + w2 + h1 + w3 + g2 + w4
  const remove = []
  for (const server of batchServers) {
    let tmpramavailable = ns.getServerMaxRam(server) - ns.getServerUsedRam(server)
    if (server === "home") tmpramavailable = Math.max(tmpramavailable - homeReservedRam, 0) //Reserve home ram for smaller things
    if (server.startsWith("hacknet") && noHacknet) continue
    let threadsonserver = Math.floor(tmpramavailable / 1.75)
    //Reduce by our checklist
    if (checklist.length > 0) checklist.forEach((c) => c.name === server ? threadsonserver -= c.threads : null)
    if (threadsonserver <= 0) {
      remove.push(server)
      continue
    }

    //W1 testing
    if (!w1test) { //No chunking
      if (threadsonserver >= w1) { //We have enough to finish it off
        let found = false
        for (let check of checklist) {
          if (check.name === server) {
            found = true
            check.threads += w1
          }
        }
        if (!found) {
          let record = {
            "name": server,
            "threads": w1
          }
          checklist.push(record)
        }
        threadsonserver -= w1
        w1test = true
        w1 = 0
      }
      else { //We have threads but not enough
        let found = false
        for (let check of checklist) {
          if (check.name === server) {
            found = true
            check.threads += threadsonserver
          }
        }
        if (!found) {
          let record = {
            "name": server,
            "threads": threadsonserver
          }
          checklist.push(record)
        }
        w1 -= threadsonserver
        threadsonserver = 0
        remove.push(server)
      }
    }

    //G1 testing
    if (w1test && !g1test) { //Chunking
      if (threadsonserver >= g1) {
        let found = false
        for (let check of checklist) {
          if (check.name === server) {
            found = true
            check.threads += g1
          }
        }
        if (!found) {
          let record = {
            "name": server,
            "threads": g1
          }
          checklist.push(record)
        }
        threadsonserver -= g1
        g1test = true
        if (g1 !== 0) {
          g1 = 0
          break //Allows the next weaken cycle to start from the lowest server again
        }
      }
    }

    //W2 testing
    if (g1test && !w2test) { //No chunking
      if (threadsonserver >= w2) { //We have enough to finish it off
        let found = false
        for (let check of checklist) {
          if (check.name === server) {
            found = true
            check.threads += w2
          }
        }
        if (!found) {
          let record = {
            "name": server,
            "threads": w2
          }
          checklist.push(record)
        }
        threadsonserver -= w2
        w2test = true
        w2 = 0
      }
      else { //We have threads but not enough
        let found = false
        for (let check of checklist) {
          if (check.name === server) {
            found = true
            check.threads += threadsonserver
          }
        }
        if (!found) {
          let record = {
            "name": server,
            "threads": threadsonserver
          }
          checklist.push(record)
        }
        w2 -= threadsonserver
        threadsonserver = 0
        remove.push(server)
      }
    }

    //H1 testing
    if (w2test && !h1test) { //Chunking
      if (threadsonserver >= h1) {
        let found = false
        for (let check of checklist) {
          if (check.name === server) {
            found = true
            check.threads += h1
          }
        }
        if (!found) {
          let record = {
            "name": server,
            "threads": h1
          }
          checklist.push(record)
        }
        threadsonserver -= h1
        h1test = true
        if (h1 !== 0) {
          h1 = 0
          break //Allows the next weaken cycle to start from the lowest server again
        }
      }
    }

    //W3 testing
    if (h1test && !w3test) { //No chunking
      if (threadsonserver >= w3) { //We have enough to finish it off
        let found = false
        for (let check of checklist) {
          if (check.name === server) {
            found = true
            check.threads += w3
          }
        }
        if (!found) {
          let record = {
            "name": server,
            "threads": w3
          }
          checklist.push(record)
        }
        threadsonserver -= w3
        w3test = true
        w3 = 0
      }
      else { //We have threads but not enough
        let found = false
        for (let check of checklist) {
          if (check.name === server) {
            found = true
            check.threads += threadsonserver
          }
        }
        if (!found) {
          let record = {
            "name": server,
            "threads": threadsonserver
          }
          checklist.push(record)
        }
        w3 -= threadsonserver
        threadsonserver = 0
        remove.push(server)
      }
    }

    //G2 testing
    if (w3test && !g2test) { //Chunking
      if (threadsonserver >= g2) {
        let found = false
        for (let check of checklist) {
          if (check.name === server) {
            found = true
            check.threads += g2
          }
        }
        if (!found) {
          let record = {
            "name": server,
            "threads": g2
          }
          checklist.push(record)
        }
        threadsonserver -= g2
        g2test = true
        if (g2 !== 0) {
          g2 = 0
          break //Allows the next weaken cycle to start from the lowest server again
        }
      }
    }

    //W4 testing
    if (g2test && !w4test) { //No chunking
      if (threadsonserver >= w4) { //We have enough to finish it off
        let found = false
        for (let check of checklist) {
          if (check.name === server) {
            found = true
            check.threads += w4
          }
        }
        if (!found) {
          let record = {
            "name": server,
            "threads": w4
          }
          checklist.push(record)
        }
        threadsonserver -= w4
        w4test = true
        w4 = 0
      }
      else { //We have threads but not enough
        let found = false
        for (let check of checklist) {
          if (check.name === server) {
            found = true
            check.threads += threadsonserver
          }
        }
        if (!found) {
          let record = {
            "name": server,
            "threads": threadsonserver
          }
          checklist.push(record)
        }
        w4 -= threadsonserver
        threadsonserver = 0
        remove.push(server)
      }
    }

    //If this is true, it's all good
    if (w4test) { //Success
      return true
    }
  }//End of batchServers
  const endcount = w1 + g1 + w2 + h1 + w3 + g2 + w4
  batchServers = batchServers.filter((f) => !remove.includes(f))
  //Did we make a change?  If so, run it again!
  if (startcount !== endcount) { // We processed something.  Keep processing until we are done.
    return check_batch(ns, w1, g1, w2, h1, w3, g2, w4, noHacknet, checklist)
  }
  else {
    return false
  }
}