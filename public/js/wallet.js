let signer;
let contract;

const CONTRACT_ADDRESS = "0x7C9069A677807e4D168e3a7c40bFbe790288Ad18";
const ABI = [
  {
    "anonymous": false,
    "inputs": [
      { "indexed": true, "internalType": "string", "name": "caseId", "type": "string" },
      { "indexed": false, "internalType": "string", "name": "fileHash", "type": "string" },
      { "indexed": true, "internalType": "address", "name": "officer", "type": "address" }
    ],
    "name": "EvidenceStored",
    "type": "event"
  },
  {
    "inputs": [
      { "internalType": "string", "name": "_caseId", "type": "string" },
      { "internalType": "string", "name": "_fileHash", "type": "string" }
    ],
    "name": "storeEvidence",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      { "internalType": "string", "name": "_caseId", "type": "string" }
    ],
    "name": "verifyEvidence",
    "outputs": [{ "internalType": "string", "name": "", "type": "string" }],
    "stateMutability": "view",
    "type": "function"
  }
];

async function connectWallet() {
  if (!window.ethereum) return alert("Please install MetaMask!");
  const provider = new ethers.providers.Web3Provider(window.ethereum);
  const sepChainId = "0xaa36a7";
  try {
    await window.ethereum.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: sepChainId }] });
  } catch (err) {
    if (err.code === 4902) alert("Please add Sepolia Network to MetaMask!");
    return;
  }
  await provider.send("eth_requestAccounts", []);
  signer = provider.getSigner();
  const address = await signer.getAddress();

  const btn = document.getElementById("connectBtn");
  btn.innerHTML = "✅ Connected: " + address.slice(0, 6) + "...";
  btn.style.background = "#059669";
  btn.style.cursor = "default";

  document.getElementById("submitBtn").disabled = false;
  contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, signer);
}

document.getElementById("uploadForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const submitBtn = document.getElementById("submitBtn");
  const statusBox = document.getElementById("statusBox");

  submitBtn.style.display = 'none';
  statusBox.className = 'ns-stb loading';
  statusBox.textContent = "⏳ Uploading to IPFS & Server...";

  try {
    // Check MetaMask is connected before doing anything
    if (!contract || !signer) {
      throw new Error("Please connect MetaMask first before uploading.");
    }

    const formData = new FormData(e.target);
    const response = await fetch('/evidence/upload-api', { method: 'POST', body: formData });
    const data = await response.json();

    if (!data.success || !data.uploaded || data.uploaded.length === 0) {
      throw new Error("Server Upload Failed");
    }

    const { uploaded, caseId } = data;

    statusBox.textContent = `🦊 Please Confirm ${uploaded.length} Transaction(s) in MetaMask...`;

    const transactions = [];

    // Sign each file on blockchain one by one
    for (let i = 0; i < uploaded.length; i++) {
      const { dbId, fileHash, fileName } = uploaded[i];
      statusBox.textContent = `🦊 Signing file ${i + 1} of ${uploaded.length}: ${fileName}`;

    const tx = await contract.storeEvidence(fileHash, fileHash);

      statusBox.textContent = `⏳ Mining transaction ${i + 1} of ${uploaded.length}...`;
      await tx.wait();

      transactions.push({ dbId, txHash: tx.hash });
    }

    // Confirm all transactions at once
    await fetch('/evidence/confirm-tx', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ transactions })
    });

    statusBox.className = 'ns-stb success';
    statusBox.innerHTML = `🎉 ${uploaded.length} file(s) secured on blockchain!<br>Last Tx: ` + transactions[transactions.length - 1].txHash.slice(0, 10) + "...";

    setTimeout(() => { window.location.href = "/evidence"; }, 2000);

  } catch (err) {
    console.error(err);
    submitBtn.style.display = 'block';
    statusBox.className = 'ns-stb error';
    statusBox.textContent = "Error: " + err.message;
  }
});