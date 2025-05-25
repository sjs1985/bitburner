import { runIt, doKill, getOwnedSF, getResetInfo, hackThePlanet, wastePids } from "sjs1985/utils.js"

/*Static port numbers for comms:
 * 1 - this script (loader) receive
 * 2 - puppetMini: emit pid
 * 3 - puppetMini: emit bestTarget
 * 4 - stocks: emit pid
 * 5 - ipvgo: emit pid
 * 6 - gangs: emit pid
 * 7 - sleeves: emit pid
 * 8 - BB: emit pid
 * 10- casino: emit pid
 * 12 - puppetMini receive
 * 13 - stocks receive
 * 15 - ipvgo receive
 * 16 - gangs receive
 * 17 - sleeves receive
 * 18 - BB receive
 * 30 - autoInfil:
 */

//Batcher Variables
let batcherUseHacknet = false
let batcherBuyServers = true
let batcherAutoHash = false
let batcherAutoBuyHacknet = false


/** @param {NS} ns */
/** @param {import(".").NS } ns */

export async function main(ns) {
    ns.ui.openTail()
    ns.disableLog("ALL")
    ns.clearLog()
    ns.ui.resizeTail(680, 620)

    await init(ns);
    await hackThePlanet(ns);

    const resetInfo = await getResetInfo(ns);
    const sourceFiles = await getOwnedSF(ns);

    while (true) {
        ns.clearLog()

        //Refresh!
        const buttonRefreshStyle = `
        .buttonRefresh{background-color: ${"green"}}
        .buttonOpenLogs{background-color: ${"green"}}
        .buttonClearActive{background-color: ${"green"}};`;
        const buttonRefresh = React.createElement(
            React.Fragment,
            null,
            React.createElement("style", null, buttonRefreshStyle),
            React.createElement("div", null,
                React.createElement("button", { className: "buttonRefresh", onClick: () => startRefresh(ns) }, "Refresh"),
                React.createElement("button", { className: "buttonOpenLogs", onClick: () => startOpenLogs(ns) }, "Re-Open Logs"),
                React.createElement("button", { className: "buttonClearActive", onClick: () => startClearActive(ns) }, "Clear Active")))

        //Batcher Button
        const batcherStatusColour = ns.peek(2) !== "NULL PORT DATA" ? "green" : "red"
        const batcherStatusHacknetColor = batcherUseHacknet ? "green" : "red"
        const batcherBuyServersColor = batcherBuyServers ? "green" : "red"
        const batcherAutoHashColor = batcherAutoHash ? "green" : "red"
        const batcherStatusName = ns.peek(2) !== "NULL PORT DATA" ? "De-Activate" : "Activate"
        const buttonBatcherStyle = `
        .buttonBatcher{background-color: ${batcherStatusColour}}
        .useHacknet{background-color: ${batcherStatusHacknetColor}}
        .autoHash{background-color: ${batcherAutoHashColor}}
        .buyServers{background-color: ${batcherBuyServersColor}};`;
        const buttonUseHacknet = hasBN(ns, resetInfo, sourceFiles, 9) ? React.createElement("button", { className: "useHacknet", onClick: () => toggleHacknet(ns) }, "Use Hacknet") : ""
        const buttonAutoHash = hasBN(ns, resetInfo, sourceFiles, 9) ? React.createElement("button", { className: "autoHash", onClick: () => toggleAutoHash(ns) }, "Auto Hash") : ""

        const buttonBatcher = React.createElement(
            React.Fragment,
            null,
            React.createElement("style", null, buttonBatcherStyle),
            React.createElement("div", null, "Batcher Status  : ",
                React.createElement("button", { className: "buttonBatcher", onClick: () => startBatcher(ns) }, batcherStatusName),
                React.createElement("button", { className: "buyServers", onClick: () => togglePurchaseServers(ns) }, "Auto-Buy Servers"),
                buttonUseHacknet,
                buttonAutoHash))
        
        const buttonAutoBuyHacknet = hasBN(ns, resetInfo, sourceFiles, 9) ? React.createElement("button", { className: "buttonAutoBuyHashnet", onClick: () => toggleAutoBuyHacknet(ns) }, "Batcher: AutoBuy") : ""
        //Hacknet Purchaser
        const buttonHacknetStyle = `
        .buttonHacknet{background-color: ${"green"}}
        .buttonAutoBuyHashnet{background-color: ${batcherAutoBuyHacknet ? "green" : "red"}};`;
        const buttonHacknet = React.createElement(
            React.Fragment,
            null,
            React.createElement("style", null, buttonHacknetStyle),
            React.createElement("div", null, "Hacknet Purchase: ",
                React.createElement("button", { className: "buttonHacknet", onClick: () => buyHacknet(ns) }, "Purchase Hacknet"),
                buttonAutoBuyHacknet))

        ns.printRaw(buttonRefresh)
        ns.printf("---------------------STANDARD---------------------")
        ns.printRaw(buttonBatcher)
        ns.printRaw(buttonHacknet)

        await ns.nextPortWrite(1)
        ns.clearPort(1)
    }

}

async function startBatcher(ns) {
    if (ns.peek(2) !== "NULL PORT DATA") {
        await doKill(ns, ns.peek(2))
    }
    else {
        const commands = []
        if (batcherUseHacknet) commands.push("usehacknet")
        if (batcherAutoHash) commands.push("autohash")
        if (!batcherBuyServers) commands.push("nopurchase")
        if (batcherAutoBuyHacknet) commands.push("autobuyhacknet")
        ns.writePort(2, await runIt(ns, "sjs1985/core/puppetMini.js", true, commands))
    }
    while (!ns.tryWritePort(1, 1)) await ns.sleep(4)
}

async function buyHacknet(ns) {
  await runIt(ns, "sjs1985/core/hacknetPurchaser.js", false, [])
  while (!ns.tryWritePort(1, 1)) await ns.sleep(4)
}

async function togglePurchaseServers(ns) {
    if (batcherBuyServers) {
        batcherBuyServers = !batcherBuyServers
        if (ns.peek(2) !== "NULL PORT DATA") ns.writePort(12, "nopurchaseservers")
    }
    else {
        batcherBuyServers = !batcherBuyServers
        if (ns.peek(2) !== "NULL PORT DATA") ns.writePort(12, "purchaseservers")
    }
    while (!ns.tryWritePort(1, 1)) await ns.sleep(4)
}

async function toggleHacknet(ns) {
    if (batcherUseHacknet) {
        batcherUseHacknet = !batcherUseHacknet
        if (ns.peek(2) !== "NULL PORT DATA") ns.writePort(12, "nohacknet")
    }
    else {
        batcherUseHacknet = !batcherUseHacknet
        if (ns.peek(2) !== "NULL PORT DATA") ns.writePort(12, "hacknet")
    }
    while (!ns.tryWritePort(1, 1)) await ns.sleep(4)
}

async function toggleAutoHash(ns) {
    if (batcherAutoHash) {
        batcherAutoHash = !batcherAutoHash
        if (ns.peek(2) !== "NULL PORT DATA") ns.writePort(12, "noautohash")
    }
    else {
        batcherAutoHash = !batcherAutoHash
        if (ns.peek(2) !== "NULL PORT DATA") ns.writePort(12, "autohash")
    }
    while (!ns.tryWritePort(1, 1)) await ns.sleep(4)
}

async function startClearActive(ns) {
    if (ns.peek(2) !== "NULL PORT DATA" && ns.peek(2) > 0) await doKill(ns, ns.peek(2))// Puppet
    if (ns.peek(4) !== "NULL PORT DATA" && ns.peek(4) > 0) await doKill(ns, ns.peek(4))// Stocks
    if (ns.peek(5) !== "NULL PORT DATA" && ns.peek(5) > 0) await doKill(ns, ns.peek(5))// IPvGo
    if (ns.peek(6) !== "NULL PORT DATA" && ns.peek(6) > 0) await doKill(ns, ns.peek(6))// Gangs
    if (ns.peek(7) !== "NULL PORT DATA" && ns.peek(7) > 0) await doKill(ns, ns.peek(7))// Sleeves
    if (ns.peek(8) !== "NULL PORT DATA" && ns.peek(8) > 0) await doKill(ns, ns.peek(8))// BB
    if (ns.peek(10) !== "NULL PORT DATA" && ns.peek(10) > 0) await doKill(ns, ns.peek(10))// Casino

    ns.clearPort(2)// Puppet
    ns.clearPort(4)// Stocks
    ns.clearPort(5)// IPvGo
    ns.clearPort(6)// Gangs
    ns.clearPort(7)// Sleeves
    ns.clearPort(8)// BB
    ns.clearPort(10)// Casino
    ns.clearPort(30)//AutoInfil

    while (!ns.tryWritePort(1, 1)) await ns.sleep(4)
}


async function startRefresh(ns) {
    while (!ns.tryWritePort(1, 1)) await ns.sleep(4)
}
async function startOpenLogs(ns) {
    if (ns.peek(2) !== "NULL PORT DATA") ns.ui.openTail(ns.peek(2)) // Puppet
    if (ns.peek(4) !== "NULL PORT DATA") ns.ui.openTail(ns.peek(4)) // Stocks
    if (ns.peek(5) !== "NULL PORT DATA") ns.ui.openTail(ns.peek(5)) // IPvGo
    if (ns.peek(6) !== "NULL PORT DATA") ns.ui.openTail(ns.peek(6)) // Gangs
    if (ns.peek(7) !== "NULL PORT DATA") ns.ui.openTail(ns.peek(7)) // Sleeves
    if (ns.peek(8) !== "NULL PORT DATA") ns.ui.openTail(ns.peek(8)) // BB
    if (ns.peek(10) !== "NULL PORT DATA") ns.ui.openTail(ns.peek(10)) // Casino
    while (!ns.tryWritePort(1, 1)) await ns.sleep(4)
}

async function init(ns) {
    //We need to reserve at least 50 pids for cross script communication ports
    for (let i = 0; i < 50; i++) await wastePids(ns)
}

function hasBN(ns, resetInfo, sourceFiles, bn, lvl = 1) {
    if (resetInfo.currentNode === bn) return true
    try {
        for (const sf of sourceFiles) if (sf.n === bn && sf.lvl >= lvl) return true
        return false
    }
    catch { return false }
}