const { ethers } = require("ethers");
const fs = require("fs");
const path = require("path");

const envPath = path.join(__dirname, "evern.evi");
if (!fs.existsSync(envPath)) {
    process.exit(1);
}

const envContent = fs.readFileSync(envPath, "utf8");
const config = {};
envContent.split("\n").forEach(line => {
    const parts = line.split("=");
    if (parts.length === 2) {
        config[parts[0].trim()] = parts[1].trim();
    }
});

const PRIVATE_KEY = config.PRIVATE_KEY;
const CONTRACT_ADDRESS = "0x5c5Ee4c39C1a733ac1dDb6a5b70b96E37DD742C0";
const ABI = JSON.parse(fs.readFileSync(path.join(__dirname, "abi.json"), "utf8"));

const rpcUrls = [
    "https://rpc.ankr.com/bsc",
    "https://bsc.publicnode.com/"
];

let currentRpcIndex = 0;
let provider;
let wallet;
let contract;

function getWorkingProvider() {
    return new Promise((resolve) => {
        let attempts = 0;
        function tryConnect() {
            const url = rpcUrls[currentRpcIndex];
            const testProvider = new ethers.JsonRpcProvider(url);
            testProvider.getBlockNumber().then(() => {
                resolve(testProvider);
            }).catch(() => {
                currentRpcIndex = (currentRpcIndex + 1) % rpcUrls.length;
                attempts++;
                if (attempts >= rpcUrls.length) {
                    setTimeout(tryConnect, 1000);
                } else {
                    tryConnect();
                }
            });
        }
        tryConnect();
    });
}

async function init() {
    provider = await getWorkingProvider();
    wallet = new ethers.Wallet(PRIVATE_KEY, provider);
    contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, wallet);
}

async function checkAndExecute() {
    try {
        if (!contract) return;
        const status = await contract.Chainlink();
        if (status === true) {
            const tx = await contract.pool();
            await tx.wait();
        }
    } catch (error) {
        try {
            currentRpcIndex = (currentRpcIndex + 1) % rpcUrls.length;
            provider = await getWorkingProvider();
            wallet = new ethers.Wallet(PRIVATE_KEY, provider);
            contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, wallet);
        } catch (e) {}
    }
}

async function startBot() {
    await init();
    setInterval(checkAndExecute, 5000);
}

process.on('uncaughtException', () => {});
process.on('unhandledRejection', () => {});

startBot();
