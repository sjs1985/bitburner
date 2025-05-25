/** @param {NS} ns */
/** @param {import(".").NS } ns */

export async function main(ns) {
    ns.ui.openTail();
    ns.disableLog("ALL")

    //  ns.print(ns.getPlayer().bitNodeN);

    let servers = await scanNetwork(ns);
    ns.print(`Hacked servers: ${servers.join(", ")}`);



    let target =     mostProfitableServer(ns, servers)[0].server;
      

}



export async function scanNetwork(ns) {
    let servers = await ns.scan(ns.getHostname());
    let scannedServers = new Set(servers);
    let hackedServers = new Set();
    let queue = [...servers];

    while (queue.length > 0) {
        let currentServer = queue.shift();

        if (ns.hasRootAccess(currentServer)) {
            if (ns.getServerMaxMoney(currentServer) > 0)
                hackedServers.add(currentServer);
        }

        let neighbors = await ns.scan(currentServer);
        for (let neighbor of neighbors) {
            if (!scannedServers.has(neighbor)) {
                if (ns.hasRootAccess(neighbor)) {
                    if (ns.getServerMaxMoney(neighbor) > 0)
                        hackedServers.add(neighbor);
                }
                scannedServers.add(neighbor);
                queue.push(neighbor);
            }
        }
    }

    return Array.from(hackedServers);
}

function mostProfitableServer(ns, servers = []) {
    const halfish = 1.8;
    const plans = [];
    for (const server of servers) {
        let hackChance = Math.round(ns.hackAnalyzeChance(server) * 100) / 100
        let totalTime = ns.getHackTime(server) + ns.getGrowTime(server) + (ns.getWeakenTime(server) * 2)
        let maxMoney = ns.getServerMaxMoney(server);
        let result = maxMoney * hackChance / totalTime

        if (ns.getServerRequiredHackingLevel(server) < (ns.getHackingLevel() / halfish)) {
            const batchCycle = {
                server: server,
                maxMoney: ns.getServerMaxMoney(server),
                result: result
            };
            plans.push(batchCycle);
        }



        //take max money / min security / min time = fairly good early scoring.  Higher is better.
    }
    const bestPlans = plans.sort((a, b) => (
        b.result - a.result
    ));
    return bestPlans;


}