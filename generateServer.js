const fastify = require('fastify')({
    logger: true
})
const Random = require('another-random-package');
const fs = require("fs");

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
async function checkoutGeneratedIDS(retries = 4){
    try {
        if(retries === 0){
            console.log("Failed to checkout generatedIDS");
            return new Error("Failed to checkout generatedIDS");
        }
        let isCheckedOut = fs.readFileSync("./json/isCheckedOut.json");
        isCheckedOut = JSON.parse(isCheckedOut);
        console.log("isCheckedOut: ", isCheckedOut);
        if (isCheckedOut.isCheckedOut) {
            console.log("Currently Checked out by another process, waiting for it to finish");
            console.log("Retries left: ", retries);
            await sleep(1000);
            return checkoutGeneratedIDS(retries-1);
        }
        isCheckedOut.isCheckedOut = true;
        fs.writeFileSync("./json/isCheckedOut.json", JSON.stringify(isCheckedOut));
        let generatedIDS = fs.readFileSync("./json/generatedIDS.json");
            generatedIDS = JSON.parse(generatedIDS);
        if (generatedIDS) {
            return generatedIDS;
        }
    } catch (e) {
        console.log(e);
    }
}

async function checkInGeneratedIDS(){
    fs.writeFileSync("./json/isCheckedOut.json", JSON.stringify({isCheckedOut: false}));
}
async function saveIDS(generatedIDS){
    fs.writeFileSync("./json/generatedIDS.json", JSON.stringify(generatedIDS,null,2));
}

async function makeIDS (requestedAmount) {
    try {
        let ids = []
        let generatedIDS = await checkoutGeneratedIDS();
        console.log("generatedIDS: ", generatedIDS)
        if(!Array.isArray(generatedIDS)) return new Error("Failed to get generatedIDS");
        while(requestedAmount > 0){
            let id = Random.randomStringNumeric(6);
            if(generatedIDS.includes(id)){
                continue;
            }
            generatedIDS.push(id);
            ids.push(id);
            requestedAmount--;
        }
        await saveIDS(generatedIDS);
        return ids;
    } catch (e) {
        console.log(e);
    } finally {
        await checkInGeneratedIDS();
    }
}

fastify.get('/id', async function (request, reply) {
    let ids = await makeIDS(1)
    reply.send({ids: ids})
})
fastify.post('/ids/random', async function (request, reply) {
    let requestedAmount = request.body.requestedAmount;
    let ids = await makeIDS(requestedAmount);
    console.log("ids: ", ids);
    reply.send({ids: ids})
})
fastify.post('/ids/serial', async function (request, reply) {
    try {
        let requestedAmount = request.body.requestedAmount;
        let generatedIDS = await checkoutGeneratedIDS();
        if (!Array.isArray(generatedIDS)) return new Error("Failed to get generatedIDS");
        let ids = [];
        while (requestedAmount > 0) {
            for (let i = 0; i <= 999999; i++) {
                let id = i.toString().padStart(6, "0");
                if (generatedIDS.includes(id)) {
                    continue;
                }
                generatedIDS.push(id);
                ids.push(id);
                requestedAmount--;
                break;
            }
        }
        await saveIDS(generatedIDS);
        console.log("ids: ", ids);
        reply.send({ids: ids})
    } catch (e) {
        console.log(e);
    } finally {
        await checkInGeneratedIDS();
    }
})
fastify.listen({ port: 3002 }, function (err, address) {
    if (err) {
        fastify.log.error(err)
        process.exit(1)
    }
})