//Puppet2 by Sphyxis
import { getServers, getSrvr, getOptimalTarget, getHackP, weakenStr, getGrowThreads, doGetScriptRam } from "sjs1985/utils.js"
import { getHckTimeBasic, getIsRunning, getPlayer, profitPerSecond, doGetServerCurSec, doGetServerMinSec } from "sjs1985/utils.js"
import { hackThePlanet, serverPurchaser, serverRun, getPortOpeners, getServersLight, getServerAvailableRam, maxRun } from "sjs1985/utils.js"
import { hashIt, getPortOpenersSing, hasBN, hacknetPurchaser, upgHomeRam, homeReservedRam } from "sjs1985/utils.js"
import { hackReady } from "sjs1985/core/hack.js"
import { growReady } from "sjs1985/core/grow.js"
import { weakenReady } from "sjs1985/core/weaken.js"

/** @type {Server[]} baseServers */
let baseServers;

//For the tail logs:
/** @type {Server} TARGET */
let TARGET = "" //Who you are hacking
/** @type {Server} NEXTTARGET */
let NEXTTARGET = "" //Whos next up
let TARGETUPDATE = false
let ZERGSTATUS = false
let ZERGSENT = 0
let ZERGREQUIRED = -1
let RECALC_GOOD = false
let RECALC_BAD = false
let PORTS_OPEN = 0
let BMODE = "B" //Batch mode:  b is not batching,  B is batching
let THREADSLEFT = 0 //Total threads used
let THREADSMAX = 0 //Total threads available
let BATCHESTOTAL = 0 //Total batches done
let BATCHESRUN = 0 //Actual batches run
let PREPW1 = 0 //Prep wave
let PREPG1 = 0
let PREPW2 = 0
let PREPH1 = 1
let PREPW3 = 0
let PREPG2 = 0
let PREPW4 = 0
let BATCHINFO;
let STARTTIME = 0
let ENDTIME = 0
let BETWEENSTART = 0
let BETWEENEND = 0
let HACKTIME = 0
let WEAKENTIME = 0
let USEHACKNET = false
let PURCHASE = true
let AUTOHASH = false
let AUTOBUYHACKNET = false
let AUTOHASHTIMER = Number.POSITIVE_INFINITY

//Configuration
let lastpid = 0
let weakenStrength = 1

/** @param {NS} ns */
export async function main(ns) {
  ns.disableLog("ALL")
  ns.ui.openTail()
  ns.clearPort(2)
  ns.writePort(2, ns.pid)
  ns.atExit(() => {
    ns.clearPort(2)
    ns.clearPort(3)
    ns.writePort(1, 1)
  })
  if (!hackReady || !growReady || !weakenReady) {
    ns.tprintf("Error with importing workers")
    ns.exit()
  }
  USEHACKNET = ns.args.includes("usehacknet")
  PURCHASE = !ns.args.includes("nopurchase")
  AUTOHASH = ns.args.includes("autohash")
  AUTOBUYHACKNET = ns.args.includes("autobuyhacknet")
  if (AUTOBUYHACKNET) AUTOHASHTIMER = (1000 * 60 * 15) + performance.now()
  await hackThePlanet(ns)
  await init(ns)
  weakenStrength = await weakenStr(ns)
  /**@type {Player} player */
  let player = await getPlayer(ns)
  //Is argument not null and is it a server?  We target it, otherwise find the best
  /*Arguments
  * ns.args[0] is target - if one is to be specified.  If no valid target is listed, it will get the best one.
  * nohacknet
  * nopurchase
  */
  const basicservers = await getServersLight(ns)
  if (ns.args[0] && basicservers.includes(ns.args[0]))
    TARGET = await getSrvr(ns, ns.args[0])
  else if (player.skills.hacking < 10) TARGET = await getSrvr(ns, "n00dles")
  else TARGET = await getOptimalTarget(ns)
  NEXTTARGET = TARGET

  //Get the batch info.  Contains: H1 W1 G1 W2 Type Take HackP
  BATCHINFO = await getHackP(ns, TARGET.hostname, -1, -1, 1)
  ns.clearPort(3)
  ns.writePort(3, TARGET.hostname) //emit our target/next target for Hash targets
  ns.writePort(1, 1)
  ns.clearPort(1)
  let spending = true
  let new_ports_open = 0
  let overflowed = false
  const SING = await hasBN(ns, 4, 2)
  const PORTOPENERRAM = await doGetScriptRam(ns, "sjs1985/singularity/getPortOpenersSing.js")
  const UPGRAM = await doGetScriptRam(ns, "sjs1985/singularity/upgradeHomeRam.js")
  while (true) {
    TARGET = await getSrvr(ns, TARGET.hostname)
    //Calc wave
    const wavew1 = Math.ceil((TARGET.hackDifficulty - TARGET.minDifficulty) / weakenStrength)
    const waveg1 = Math.ceil(await getGrowThreads(ns, TARGET.hostname, TARGET.moneyAvailable, TARGET.minDifficulty))

    //Refresh times.  Hack Time is the constant for that.  3.2x for Grow, 4x for Weaken
    HACKTIME = await getHckTimeBasic(ns, TARGET.hostname)
    WEAKENTIME = HACKTIME * 4
    //Refresh base servers
    baseServers = await getServers(ns)
    //Get thread information
    THREADSLEFT = 0

    for (const server of baseServers) {
      if (server.hostname.startsWith("hacknet") && !USEHACKNET) continue
      if (server.hasAdminRights && server.maxRam > 0) {
        let tmpramavailable = await getServerAvailableRam(ns, server.hostname)

        if (server.hostname === "home") tmpramavailable = Math.max(tmpramavailable - homeReservedRam, 0)
        let tmpthreads = Math.floor(tmpramavailable / 1.75)
        THREADSLEFT += tmpthreads
      }
    }
    THREADSMAX = THREADSLEFT

    //Figure out how many threads to assign to the wave, and where they will go for best usage.
    //First weaken
    if (wavew1 > THREADSLEFT) { //We need too many!
      PREPW1 = THREADSLEFT
      THREADSLEFT = 0
    }
    else { //Enough to fit
      PREPW1 = wavew1
      THREADSLEFT -= PREPW1  //Could be as low as 0 now
    }

    // If we have threads left, move on to Grow/Weaken
    if (waveg1 > THREADSLEFT) { //We need more grow than we can handle
      PREPW2 = Math.ceil((THREADSLEFT * .004) / weakenStrength) //Figure out how many weaken threads we need to accomodate the highest
      PREPG1 = THREADSLEFT - PREPW2 //Fill in as many grows as can fit now
      THREADSLEFT = 0
    }
    else { //We can handle the total grow threads, but can we handle it with weaken?
      PREPW2 = Math.ceil((waveg1 * .004) / weakenStrength) //total weakens we need for a full grow
      if (PREPW2 + waveg1 <= THREADSLEFT) {//We have enough for both grow and weaken!
        PREPG1 = waveg1
        THREADSLEFT -= PREPG1 + PREPW2 //Could be as low as 0 now
      }
      else { //We don't have enough.  Calculate optimal
        const growP = .004 / weakenStrength
        const remainder = waveg1 + PREPW2 - THREADSLEFT
        const weakremove = Math.floor(remainder * growP)
        const growremove = remainder - weakremove
        PREPG1 = waveg1 - growremove
        PREPW2 -= weakremove
        THREADSLEFT = 0
      }
    }

    //If we have threads left, move on to Hack/Weaken
    if (BATCHINFO.H1 > THREADSLEFT) { //We don't have enough to fully hack!
      PREPW3 = Math.floor((THREADSLEFT * .002) / weakenStrength)
      PREPH1 = THREADSLEFT - PREPW3
      THREADSLEFT = 0
    }
    else { //We can handle the total hack threads, but what about the weakens it produces?
      PREPW3 = Math.ceil((BATCHINFO.H1 * .002) / weakenStrength)
      if (PREPW3 + BATCHINFO.H1 <= THREADSLEFT) { //We have enough for both hack and weaken
        PREPH1 = BATCHINFO.H1
        THREADSLEFT -= PREPH1 + PREPW3
      }
      else { //We don'thave enough.  Calculate optimal
        const hackP = .002 / weakenStrength
        const remainder = BATCHINFO.H1 + PREPW3 - THREADSLEFT
        const weakenremove = Math.floor(remainder * hackP)
        const hackremove = remainder - weakenremove
        PREPH1 = BATCHINFO.H1 - hackremove
        PREPW3 -= weakenremove
        THREADSLEFT = 0
      }
    }

    // If we have threads left, move on to Grow/Weaken
    if (BATCHINFO.G1 > THREADSLEFT) { //We need more grow than we can handle
      PREPW4 = Math.ceil((THREADSLEFT * .004) / weakenStrength) //Figure out how many weaken threads we need to accomodate the highest
      PREPG2 = THREADSLEFT - PREPW4 //Fill in as many grows as can fit now
      THREADSLEFT = 0
    }
    else { //We can handle the total grow threads, but can we handle it with weaken?
      PREPW4 = Math.ceil((BATCHINFO.G1 * .004) / weakenStrength) //total weakens we need for a full grow
      if (PREPW4 + BATCHINFO.G1 <= THREADSLEFT) {//We have enough for both grow and weaken!
        PREPG2 = BATCHINFO.G1
        THREADSLEFT -= PREPG2 + PREPW4 //Could be as low as 0 now
      }
      else { //We don't have enough.  Calculate optimal
        const growP = .004 / weakenStrength
        const remainder = BATCHINFO.G1 + PREPW4 - THREADSLEFT
        const weakremove = Math.floor(remainder * growP)
        const growremove = remainder - weakremove
        PREPG2 = BATCHINFO.G1 - growremove
        PREPW4 -= weakremove
        THREADSLEFT = 0
      }
    }
    BATCHESTOTAL = Math.floor(THREADSLEFT / (BATCHINFO.H1 + BATCHINFO.W1 + BATCHINFO.G1 + BATCHINFO.W2))
    if (ZERGSTATUS && ZERGREQUIRED !== ZERGSENT && BATCHESTOTAL > 3) BATCHESTOTAL = Math.max(Math.max(Math.floor(BATCHESTOTAL * 4 / 5), BATCHESTOTAL - 50), 0) //Reserve a few batches to send as zerglings

    BETWEENEND = performance.now()
    STARTTIME = performance.now()
    //Start it all and get the results
    const results = await serverRun(ns, TARGET.hostname, PREPW1, PREPG1, PREPW2, PREPH1, PREPW3, PREPG2, PREPW4, BATCHINFO.H1, BATCHINFO.W1, BATCHINFO.G1, BATCHINFO.W2, BATCHESTOTAL, !USEHACKNET)
    ENDTIME = performance.now()

    lastpid = results.lastpid
    RECALC_BAD = results.recalc
    BATCHESRUN = results.batches
    BMODE = results.batching ? "B" : "b"
    THREADSLEFT -= (BATCHINFO.H1 + BATCHINFO.W1 + BATCHINFO.G1 + BATCHINFO.W2) * BATCHESRUN //Includes the wave as a batch
    if (ZERGSTATUS && THREADSLEFT > 0 && ZERGREQUIRED !== ZERGSENT && BATCHESTOTAL > 2) await zerglings(ns, THREADSLEFT)  //If zerg is on, send the lings!

    //Now that we have the next batch ready, we wait...
    while (await getIsRunning(ns, lastpid)) {
      await ns.sleep(20)
      update_hud(ns)
      getCommands(ns)
    }
    update_hud(ns)
    getCommands(ns)

    BETWEENSTART = performance.now()
    //If our hacking has gone up, recalculate
    /**@type {Player} player2 */
    const player2 = await getPlayer(ns)
    const maxRam = await maxRun(ns, false)
    const homeRam = await getServerAvailableRam(ns, "home")
    if (SING && homeRam < homeReservedRam && maxRam > UPGRAM) await upgHomeRam(ns)
    if (PORTS_OPEN < 5) new_ports_open = SING && PORTOPENERRAM <= maxRam ? await getPortOpenersSing(ns) : await getPortOpeners(ns)
    if (PURCHASE && spending) if (!await serverPurchaser(ns)) spending = false
    if (AUTOHASH) {
      await hashIt(ns, "max")
      await hashIt(ns, "min")
    }
    if (AUTOBUYHACKNET && AUTOHASHTIMER <= performance.now()) {
      if (!await hacknetPurchaser(ns)) AUTOHASHTIMER = Number.POSITIVE_INFINITY
      else AUTOHASHTIMER = performance.now() + (1000 * 60 * 15)
    }
    if ((player2.skills.hacking > player.skills.hacking + 20 && BATCHESTOTAL > 3) || BATCHESTOTAL > 3 && PORTS_OPEN !== new_ports_open) {
      player = player2
      RECALC_GOOD = true
      TARGETUPDATE = true
      if (PORTS_OPEN !== new_ports_open) {
        PORTS_OPEN = new_ports_open
        await hackThePlanet(ns)
      }
    }

    if (NEXTTARGET.hostname === TARGET.hostname && TARGETUPDATE) { //Nexttarget is target.  We are open for a new target     
      /**@type {Server} upcoming */
      const upcoming = await getOptimalTarget(ns)
      if (upcoming.hostname !== TARGET.hostname) { //We have an up and commer that's better.  Start zerglings
        NEXTTARGET = upcoming
        ZERGSTATUS = true
      }
      TARGETUPDATE = false
    }
    else if (NEXTTARGET.hostname !== TARGET.hostname && await doGetServerCurSec(ns, NEXTTARGET.hostname) === await doGetServerMinSec(ns, NEXTTARGET.hostname)) { //Ready for the change over
      TARGET = NEXTTARGET
      ZERGSTATUS = false
      ZERGSENT = 0
      ZERGREQUIRED = -1
      RECALC_BAD = false
      RECALC_GOOD = false
      overflowed = false
      //Get the batch info.  Contains: H1 W1 G1 W2 Type Take HackP
      BATCHINFO = await getHackP(ns, TARGET.hostname, -1, -1, 1)
      TARGETUPDATE = true
    }
    ns.clearPort(3)
    ns.writePort(3, TARGET.hostname) //emit our target/next target for Hash targets

    if (RECALC_BAD) {
      BATCHINFO = await getHackP(ns, TARGET.hostname, BATCHESRUN, THREADSMAX, BATCHINFO.H1)
      RECALC_BAD = false
      overflowed = true
    }
    else if (RECALC_GOOD && !overflowed) {
      BATCHINFO = await getHackP(ns, TARGET.hostname, -1, -1, 1)
      RECALC_GOOD = false
    }
    else BATCHINFO = await getHackP(ns, TARGET.hostname, -1, -1, Math.max(BATCHINFO.H1 - 1, 1))
  }//while (true) loop
}

/** @param {NS} ns */
function update_hud(ns) {
  ns.clearLog()
  ns.printf("%s[%s] - (%s)", TARGET.hostname, BMODE, BATCHINFO.Type)
  if (TARGET.hostname !== NEXTTARGET.hostname) ns.printf("Next: %s  Zerglings: %s/%s", NEXTTARGET.hostname, ZERGSENT, ZERGREQUIRED === -1 ? "Waiting" : ZERGREQUIRED)
  ns.printf("%s/%s(%s) Batches: %s  Take: $%s", THREADSMAX - THREADSLEFT, THREADSMAX, THREADSLEFT, BATCHESRUN + 1, ns.formatNumber(BATCHINFO.Take * (BATCHESRUN + 1) * PREPH1 / BATCHINFO.H1))
  ns.printf("HackP: %s%s ($%s/each)  Chance: %s%s", Math.round(BATCHINFO.HackP * 10000 * PREPH1) / 100, "%", ns.formatNumber(BATCHINFO.Take * PREPH1 / BATCHINFO.H1), ns.formatNumber(BATCHINFO.Chance * 100, 2), "%")
  ns.printf("Prep Wave: W:%s G:%s W:%s H:%s W:%s G:%s W:%s", PREPW1, PREPG1, PREPW2, PREPH1, PREPW3, PREPG2, PREPW4)
  ns.printf("Batching Composition: H:%s W:%s G:%s W:%s", BATCHINFO.H1, BATCHINFO.W1, BATCHINFO.G1, BATCHINFO.W2)
  ns.printf("%s  Countdown: %s", "$" + profitPerSecond(ns, WEAKENTIME, BATCHINFO.Take * BATCHINFO.H1 / PREPH1, BATCHESRUN + 1), ns.tFormat((WEAKENTIME + ENDTIME) - performance.now()))
  ns.printf("Preptime : %s", ns.tFormat(BETWEENEND - BETWEENSTART, true))
  ns.printf("Loadtime : %s", ns.tFormat(ENDTIME - STARTTIME, true))
  ns.printf("Batchtime: %s", ns.tFormat(WEAKENTIME, true))

  if (AUTOBUYHACKNET) ns.printf("Auto Buy Hash: %s", AUTOHASHTIMER - performance.now() > 0 ? ns.tFormat(AUTOHASHTIMER - performance.now()) : "Next Up")
}

/** @param {NS} ns */
async function zerglings(ns, threads) {
  if (ZERGREQUIRED <= 0) ZERGREQUIRED = Math.ceil((NEXTTARGET.hackDifficulty - NEXTTARGET.minDifficulty) / weakenStrength) + 1
  if (ZERGSENT >= ZERGREQUIRED || threads === 0) return
  const weakthreadsneeded = Math.ceil((NEXTTARGET.hackDifficulty - NEXTTARGET.minDifficulty) / weakenStrength) + 1 - ZERGSENT
  const threadsthisround = weakthreadsneeded >= threads ? threads : weakthreadsneeded

  if (threadsthisround > 0) { //We are sending zerglings
    ZERGSENT += threadsthisround
    THREADSLEFT -= threadsthisround
    await serverRun(ns, NEXTTARGET.hostname, threadsthisround, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, !ns.args.includes("usehacknet"))
  }
}
function getCommands(ns) {
  while (ns.peek(12) !== "NULL PORT DATA") { //1-4  1: noHacknet, 2: !noHacknet, 3: buyServers, 4: !buyServers
    let result = ns.readPort(12)
    switch (result) {
      case "nohacknet":
        ns.tprintf("Command received.  Puppet will not use Hacknet nodes now")
        USEHACKNET = false
        break;
      case "hacknet":
        ns.tprintf("Command received.  Puppet will use Hacknet nodes now")
        USEHACKNET = true
        break;
      case "purchaseservers":
        ns.tprintf("Command received.  Puppet will purchase servers")
        PURCHASE = true
        break;
      case "nopurchaseservers":
        ns.tprintf("Command received.  Puppet will not purchase servers")
        PURCHASE = false
        break;
      case "autohash":
        ns.tprintf("Command received.  Puppet will automatically spend hashes")
        AUTOHASH = true
        break;
      case "autobuyhacknet":
        ns.tprintf("Command received.  Puppet will automatically buy hacknet servers")
        AUTOBUYHACKNET = true
        AUTOHASHTIMER = performance.now() + (1000 * 60 * 15)
        break;
      case "noautobuyhacknet":
        ns.tprintf("Command received.  Puppet will not buy hacknet servers")
        AUTOBUYHACKNET = false
        AUTOHASHTIMER = Number.POSITIVE_INFINITY
        break;
      case "noautohash":
        ns.tprintf("Command received.  Puppet will not automatically spend hashes")
        AUTOHASH = false
        break;
      default:
        ns.tprintf("Invalid command received in puppetMini: %s", result)
        break;
    }
  }
}

/** @param {NS} ns */
async function init(ns) {
  baseServers = await getServers(ns)
  TARGET = "" //Who you are hacking
  NEXTTARGET = "" //Whos next up
  TARGETUPDATE = false
  ZERGSTATUS = false
  ZERGSENT = 0
  ZERGREQUIRED = -1
  RECALC_GOOD = false
  RECALC_BAD = false
  PORTS_OPEN = await getPortOpeners(ns)
  BMODE = "B" //Batching style.  b is not batching, B is batching
  THREADSMAX = 0 //Total threads available
  BATCHESTOTAL = 0 //Total batches done
  BATCHESRUN = 0 //Total batches actually run
  PREPW1 = 0 //Prep wave
  PREPG1 = 0
  PREPW2 = 0
  PREPH1 = 1
  PREPW3 = 0
  PREPG2 = 0
  PREPW4 = 0
  STARTTIME = 0
  ENDTIME = 0
  BETWEENSTART = performance.now()
  BETWEENEND = 0
  WEAKENTIME = 0
}
