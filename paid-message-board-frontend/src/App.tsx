import { useEffect, useState } from "react";
import {
  BrowserProvider,
  Contract,
  formatEther,
  parseEther,
  Network,
} from "ethers";
import abi from "./abi.json";
import { CONTRACT_ADDRESS } from "./contractConfig";

interface Message {
  sender: string;
  content: string;
  timestamp: string;
}

function App() {
  const [walletAddress, setWalletAddress] = useState<string>("");
  const [walletBalance, setWalletBalance] = useState<string>("");
  const [networkName, setNetworkName] = useState<string>("");
  const [isCorrectNetwork, setIsCorrectNetwork] = useState<boolean>(false);
  const [isOwner, setIsOwner] = useState<boolean>(false);
  const [isPosting, setIsPosting] = useState<boolean>(false);
  const [isWithdrawing, setIsWithdrawing] = useState<boolean>(false);

  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState<string>("");
  const [contractBalance, setContractBalance] = useState<string>("");

  // Toast
  const [toast, setToast] = useState<{
    message: string;
    type: "success" | "error" | "info";
  } | null>(null);

  const postingFee = parseEther("0.001");
  const SEPOLIA_CHAIN_ID = 11155111;

  const getEthereum = () => (window as any).ethereum;
  const shorten = (a: string) => `${a.slice(0, 6)}...${a.slice(-4)}`;

  // ---------- Toast Helper ----------
  const showToast = (
    message: string,
    type: "success" | "error" | "info" = "info"
  ) => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  // ---------- Core Wallet Initialization ----------
  const initFromAccount = async (account: string) => {
    try {
      const eth = getEthereum();
      const provider = new BrowserProvider(eth);
      const net: Network = await provider.getNetwork();

      setWalletAddress(account);
      setNetworkName(net.name);
      setIsCorrectNetwork(Number(net.chainId) === SEPOLIA_CHAIN_ID);

      await checkOwner(account);
      await loadWalletBalance(account);
      await loadMessages();
      await loadContractBalance();

      showToast(`Connected: ${shorten(account)}`, "success");
    } catch (err) {
      console.error(err);
      showToast("Failed to initialize wallet", "error");
    }
  };

  // ---------- Load Wallet Balance ----------
  const loadWalletBalance = async (account: string) => {
    try {
      const eth = getEthereum();
      const provider = new BrowserProvider(eth);
      const bal = await provider.getBalance(account);
      setWalletBalance(formatEther(bal));
    } catch (err) {
      console.error(err);
    }
  };

  // ---------- Check Owner Status ----------
  const checkOwner = async (user: string) => {
    try {
      const eth = getEthereum();
      const provider = new BrowserProvider(eth);
      const contract = new Contract(CONTRACT_ADDRESS, abi, provider);

      const owner: string = await contract.owner();
      setIsOwner(owner.toLowerCase() === user.toLowerCase());
    } catch {
      setIsOwner(false);
    }
  };

  // ---------- Load Messages ----------
  const loadMessages = async () => {
    try {
      const eth = getEthereum();
      const provider = new BrowserProvider(eth);
      const contract = new Contract(CONTRACT_ADDRESS, abi, provider);

      const count = Number(await contract.getMessageCount());
      const items: Message[] = [];

      for (let i = 0; i < count; i++) {
        const m = await contract.messages(i);
        items.push({
          sender: m[0],
          content: m[1],
          timestamp: new Date(Number(m[2]) * 1000).toLocaleString(),
        });
      }
      setMessages(items.reverse());
    } catch (err) {
      console.error(err);
    }
  };

  // ---------- Load Contract Balance ----------
  const loadContractBalance = async () => {
    try {
      const eth = getEthereum();
      const provider = new BrowserProvider(eth);
      const bal = await provider.getBalance(CONTRACT_ADDRESS);
      setContractBalance(formatEther(bal));
    } catch (err) {
      console.error(err);
    }
  };

  // ---------- Connect Wallet ----------
  const connectWallet = async () => {
    try {
      const eth = getEthereum();
      if (!eth) return showToast("MetaMask not detected", "error");

      const accounts = await eth.request({ method: "eth_requestAccounts" });
      await initFromAccount(accounts[0]);
    } catch {
      showToast("Failed to connect wallet", "error");
    }
  };

  // ---------- Disconnect Wallet ----------
  const disconnectWallet = () => {
    setWalletAddress("");
    setWalletBalance("");
    setMessages([]);
    setContractBalance("");

    showToast("Wallet disconnected", "info");
  };

  // ---------- Post Message ----------
  const postMessage = async () => {
    if (!isCorrectNetwork) return showToast("Switch to Sepolia first", "error");
    if (!newMessage.trim()) return showToast("Enter a message", "error");

    try {
      setIsPosting(true);          // START LOADING
      showToast("Posting…", "info");

      const eth = getEthereum();
      const provider = new BrowserProvider(eth);
      const signer = await provider.getSigner();
      const contract = new Contract(CONTRACT_ADDRESS, abi, signer);

      const tx = await contract.postMessage(newMessage, { value: postingFee });
      await tx.wait();

      showToast("Message posted ✔️", "success");
      setNewMessage("");
      loadMessages();
      loadWalletBalance(walletAddress);
      loadContractBalance();
    } catch {
      showToast("Failed to post", "error");
    } finally {
      setIsPosting(false);         // END LOADING
    }
  };

  // ---------- Withdraw Funds ----------
  const withdrawFunds = async () => {
    try {
      setIsWithdrawing(true);  // START LOADING
      showToast("Withdrawing…", "info");

      const eth = getEthereum();
      const provider = new BrowserProvider(eth);
      const signer = await provider.getSigner();
      const contract = new Contract(CONTRACT_ADDRESS, abi, signer);

      const tx = await contract.withdrawFunds();
      await tx.wait();

      showToast("Withdrawn ✔️", "success");
      loadContractBalance();
      loadWalletBalance(walletAddress);
    } catch {
      showToast("Withdraw failed", "error");
    } finally {
      setIsWithdrawing(false); // END LOADING
    }
  };


  // ---------- Auto-update on MetaMask events ----------
  useEffect(() => {
    const eth = getEthereum();
    if (!eth) return;

    eth.on("accountsChanged", (accs: string[]) => {
      if (accs.length === 0) disconnectWallet();
      else initFromAccount(accs[0]);
    });

    eth.on("chainChanged", () => {
      if (walletAddress) initFromAccount(walletAddress);
    });
  }, [walletAddress]);

  // ============================================================
  // UI
  // ============================================================

  return (
    <div
      style={{
        width: "100%",
        minHeight: "100vh",
        padding: "30px",
        boxSizing: "border-box",
        background: "#fafaff",
        fontFamily: "Inter, sans-serif",
        color: "#1a1a1a",
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: "20px",
          background: "linear-gradient(90deg,#7b2ff7,#f107a3)",
          borderRadius: "12px",
          color: "white",
          marginBottom: "25px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          boxShadow: "0 6px 20px rgba(0,0,0,0.15)",
        }}
      >
        <h1 style={{ margin: 0 }}>💬 Paid Message Board</h1>

        {!walletAddress ? (
          <button
            onClick={connectWallet}
            style={{
              padding: "10px 18px",
              background: "white",
              color: "#7b2ff7",
              border: "none",
              fontWeight: "bold",
              borderRadius: "8px",
              cursor: "pointer",
            }}
          >
            Connect Wallet
          </button>
        ) : (
          <button
            onClick={disconnectWallet}
            style={{
              padding: "10px 18px",
              background: "#ffffff",
              color: "#7b2ff7",
              border: "none",
              borderRadius: "8px",
              cursor: "pointer",
              fontWeight: "bold",
            }}
          >
            {shorten(walletAddress)} (Disconnect)
          </button>
        )}
      </div>

      {/* Wrong Network Warning */}
      {walletAddress && !isCorrectNetwork && (
        <div
          style={{
            padding: "15px",
            background: "#ffe1e1",
            border: "1px solid #ff9c9c",
            borderRadius: "8px",
            marginBottom: "20px",
          }}
        >
          ❌ Wrong Network — Switch to <b>Sepolia</b>.
        </div>
      )}

      {/* Not Connected */}
      {!walletAddress ? (
        <div
          style={{
            marginTop: "60px",
            textAlign: "center",
            color: "#555",
            fontSize: "20px",
          }}
        >
          👋 Connect your MetaMask wallet to continue.
        </div>
      ) : (
        <>
          {/* Summary Card */}
          <div
            style={{
              background: "white",
              padding: "20px",
              borderRadius: "12px",
              marginBottom: "25px",
              boxShadow: "0 6px 20px rgba(0,0,0,0.1)",
              borderLeft: "5px solid #7b2ff7",
            }}
          >
            <h2 style={{ marginTop: 0, color: "#7b2ff7" }}>
              Your Wallet Summary
            </h2>

            <p style={{ margin: "6px 0" }}>
              <b>Address:</b> {shorten(walletAddress)}
            </p>

            <p style={{ margin: "6px 0" }}>
              <b>Balance:</b>{" "}
              {walletBalance ? Number(walletBalance).toFixed(4) : "..."} ETH
            </p>

            <p style={{ margin: "6px 0" }}>
              <b>Network:</b> {networkName}
            </p>
          </div>

          {/* Post Message */}
          <div
            style={{
              background: "white",
              padding: "20px",
              borderRadius: "12px",
              marginBottom: "25px",
              boxShadow: "0 6px 20px rgba(0,0,0,0.1)",
            }}
          >
            <h2 style={{ marginTop: 0, color: "#7b2ff7" }}>Post a Message</h2>

           <textarea
              rows={3}
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              disabled={isPosting}
              style={{
                width: "95%",
                padding: "10px",
                borderRadius: "8px",
                border: "1px solid #ccc",
                marginBottom: "10px",
                background: isPosting ? "#f3f3f3" : "white",
                opacity: isPosting ? 0.7 : 1,
                color: "black"
              }}
              placeholder="Enter your message…"
            />

            {isPosting ? (
              <div
                style={{
                  padding: "12px",
                  borderRadius: "8px",
                  background: "#eee",
                  textAlign: "center",
                  fontWeight: "bold",
                  color: "#7b2ff7",
                }}
              >
                ⏳ Posting your message…
              </div>
            ) : (
              <button
                onClick={postMessage}
                disabled={!isCorrectNetwork}
                style={{
                  padding: "10px 20px",
                  background: "#7b2ff7",
                  border: "none",
                  borderRadius: "8px",
                  color: "white",
                  cursor: "pointer",
                  fontWeight: "bold",
                  opacity: isCorrectNetwork ? 1 : 0.5,
                }}
              >
                Submit (0.001 ETH)
              </button>
            )}
          </div>

          {/* Owner Panel */}
          {isOwner && (
            <div
              style={{
                background: "white",
                padding: "20px",
                borderRadius: "12px",
                marginBottom: "25px",
                boxShadow: "0 6px 20px rgba(0,0,0,0.1)",
              }}
            >
              <h2 style={{ marginTop: 0, color: "#ff007a" }}>Owner Panel</h2>

              <p>
                Contract Balance: <b>{contractBalance}</b> ETH
              </p>

              {isWithdrawing ? (
              <div
                style={{
                  padding: "12px",
                  borderRadius: "8px",
                  background: "#ffe5f2",
                  textAlign: "center",
                  fontWeight: "bold",
                  color: "#ff007a",
                }}
              >
                ⏳ Withdrawing funds…
              </div>
            ) : (
              <button
                onClick={withdrawFunds}
                disabled={!isCorrectNetwork}
                style={{
                  padding: "10px 20px",
                  background: "#ff007a",
                  border: "none",
                  borderRadius: "8px",
                  color: "white",
                  fontWeight: "bold",
                  cursor: "pointer",
                  opacity: isCorrectNetwork ? 1 : 0.5,
                }}
              >
                Withdraw Funds
              </button>
            )}

            </div>
          )}

          {/* Messages */}
          <h2 style={{ color: "#7b2ff7" }}>Messages</h2>

          {messages.length === 0 ? (
            <p>No messages yet.</p>
          ) : (
            messages.map((msg, i) => (
              <div
                key={i}
                style={{
                  background: "white",
                  padding: "15px",
                  borderRadius: "12px",
                  marginBottom: "15px",
                  boxShadow: "0 4px 15px rgba(0,0,0,0.08)",
                  borderLeft: "5px solid #7b2ff7",
                }}
              >
                <p>
                  <b>From:</b> {msg.sender}
                </p>
                <p>
                  <b>Message:</b> {msg.content}
                </p>
                <p style={{ fontSize: "13px", color: "#555" }}>
                  {msg.timestamp}
                </p>
              </div>
            ))
          )}
        </>
      )}

      {/* Toast Notification */}
      {toast && (
        <div
          style={{
            position: "fixed",
            bottom: "30px",
            right: "30px",
            background:
              toast.type === "success"
                ? "#4caf50"
                : toast.type === "error"
                ? "#f44336"
                : "#333",
            color: "white",
            padding: "14px 20px",
            borderRadius: "8px",
            boxShadow: "0 4px 15px rgba(0,0,0,0.2)",
            fontSize: "15px",
            zIndex: 9999,
          }}
        >
          {toast.message}
        </div>
      )}
    </div>
  );
}

export default App;
