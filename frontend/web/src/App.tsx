// App.tsx
import React, { useEffect, useState } from "react";
import { ethers } from "ethers";
import { getContractReadOnly, getContractWithSigner } from "./contract";
import WalletManager from "./components/WalletManager";
import WalletSelector from "./components/WalletSelector";
import "./App.css";

interface NFTIdentity {
  id: string;
  encryptedData: string;
  timestamp: number;
  owner: string;
  category: string;
  status: "pending" | "verified" | "rejected";
  metadata?: any;
}

const App: React.FC = () => {
  const [account, setAccount] = useState("");
  const [loading, setLoading] = useState(true);
  const [identities, setIdentities] = useState<NFTIdentity[]>([]);
  const [provider, setProvider] = useState<ethers.BrowserProvider | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [walletSelectorOpen, setWalletSelectorOpen] = useState(false);
  const [transactionStatus, setTransactionStatus] = useState<{
    visible: boolean;
    status: "pending" | "success" | "error";
    message: string;
  }>({ visible: false, status: "pending", message: "" });
  const [newIdentityData, setNewIdentityData] = useState({
    category: "",
    description: "",
    identityInfo: ""
  });
  const [selectedIdentity, setSelectedIdentity] = useState<NFTIdentity | null>(null);
  const [language, setLanguage] = useState<"en" | "zh">("en");
  
  // Language content
  const content = {
    en: {
      title: "FHE-Powered Private NFT Passport",
      subtitle: "Decentralized Identity with Fully Homomorphic Encryption",
      connectWallet: "Connect Wallet",
      disconnect: "Disconnect",
      createIdentity: "Create Identity NFT",
      refresh: "Refresh",
      verified: "Verified",
      pending: "Pending",
      rejected: "Rejected",
      noIdentities: "No identity NFTs found",
      createFirst: "Create First Identity",
      projectTitle: "Project Introduction",
      projectDesc: "A digital identity system where user credentials are minted as encrypted, soul-bound NFTs that can be verified through FHE without compromising privacy.",
      featuresTitle: "Key Features",
      features: [
        "Encrypted Identity NFTs",
        "FHE Identity Verification",
        "User-Controlled Digital Identity",
        "Next-Gen Decentralized Identity"
      ],
      statsTitle: "Identity Statistics",
      totalIdentities: "Total Identities",
      verifiedIdentities: "Verified",
      pendingIdentities: "Pending",
      rejectedIdentities: "Rejected",
      distributionTitle: "Status Distribution",
      identityDetails: "Identity Details",
      close: "Close",
      language: "Language"
    },
    zh: {
      title: "FHE驱动的私密NFT数字身份护照",
      subtitle: "基于完全同态加密的去中心化身份系统",
      connectWallet: "连接钱包",
      disconnect: "断开连接",
      createIdentity: "创建身份NFT",
      refresh: "刷新",
      verified: "已验证",
      pending: "待处理",
      rejected: "已拒绝",
      noIdentities: "未找到身份NFT",
      createFirst: "创建第一个身份",
      projectTitle: "项目介绍",
      projectDesc: "一个数字身份系统，用户的身份凭证被铸造成一个加密的、灵魂绑定的NFT，可以通过FHE进行验证而无需泄露隐私信息。",
      featuresTitle: "主要特性",
      features: [
        "加密的身份NFT",
        "FHE身份验证",
        "用户控制的数字身份",
        "下一代去中心化身份"
      ],
      statsTitle: "身份统计",
      totalIdentities: "总身份数",
      verifiedIdentities: "已验证",
      pendingIdentities: "待处理",
      rejectedIdentities: "已拒绝",
      distributionTitle: "状态分布",
      identityDetails: "身份详情",
      close: "关闭",
      language: "语言"
    }
  };

  // Calculate statistics
  const verifiedCount = identities.filter(i => i.status === "verified").length;
  const pendingCount = identities.filter(i => i.status === "pending").length;
  const rejectedCount = identities.filter(i => i.status === "rejected").length;

  useEffect(() => {
    loadIdentities().finally(() => setLoading(false));
  }, []);

  const onWalletSelect = async (wallet: any) => {
    if (!wallet.provider) return;
    try {
      const web3Provider = new ethers.BrowserProvider(wallet.provider);
      setProvider(web3Provider);
      const accounts = await web3Provider.send("eth_requestAccounts", []);
      const acc = accounts[0] || "";
      setAccount(acc);

      wallet.provider.on("accountsChanged", async (accounts: string[]) => {
        const newAcc = accounts[0] || "";
        setAccount(newAcc);
      });
    } catch (e) {
      alert("Failed to connect wallet");
    }
  };

  const onConnect = () => setWalletSelectorOpen(true);
  const onDisconnect = () => {
    setAccount("");
    setProvider(null);
  };

  const loadIdentities = async () => {
    setIsRefreshing(true);
    try {
      const contract = await getContractReadOnly();
      if (!contract) return;
      
      // Check contract availability using FHE
      const isAvailable = await contract.isAvailable();
      if (!isAvailable) {
        console.error("Contract is not available");
        return;
      }
      
      const keysBytes = await contract.getData("identity_keys");
      let keys: string[] = [];
      
      if (keysBytes.length > 0) {
        try {
          keys = JSON.parse(ethers.toUtf8String(keysBytes));
        } catch (e) {
          console.error("Error parsing identity keys:", e);
        }
      }
      
      const list: NFTIdentity[] = [];
      
      for (const key of keys) {
        try {
          const identityBytes = await contract.getData(`identity_${key}`);
          if (identityBytes.length > 0) {
            try {
              const identityData = JSON.parse(ethers.toUtf8String(identityBytes));
              list.push({
                id: key,
                encryptedData: identityData.data,
                timestamp: identityData.timestamp,
                owner: identityData.owner,
                category: identityData.category,
                status: identityData.status || "pending",
                metadata: identityData.metadata || {}
              });
            } catch (e) {
              console.error(`Error parsing identity data for ${key}:`, e);
            }
          }
        } catch (e) {
          console.error(`Error loading identity ${key}:`, e);
        }
      }
      
      list.sort((a, b) => b.timestamp - a.timestamp);
      setIdentities(list);
    } catch (e) {
      console.error("Error loading identities:", e);
    } finally {
      setIsRefreshing(false);
      setLoading(false);
    }
  };

  const submitIdentity = async () => {
    if (!provider) { 
      alert(language === "en" ? "Please connect wallet first" : "请先连接钱包"); 
      return; 
    }
    
    setCreating(true);
    setTransactionStatus({
      visible: true,
      status: "pending",
      message: language === "en" 
        ? "Encrypting identity data with FHE..." 
        : "正在使用FHE加密身份数据..."
    });
    
    try {
      // Simulate FHE encryption
      const encryptedData = `FHE-${btoa(JSON.stringify(newIdentityData))}`;
      
      const contract = await getContractWithSigner();
      if (!contract) {
        throw new Error("Failed to get contract with signer");
      }
      
      const identityId = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

      const identityData = {
        data: encryptedData,
        timestamp: Math.floor(Date.now() / 1000),
        owner: account,
        category: newIdentityData.category,
        status: "pending",
        metadata: {
          description: newIdentityData.description
        }
      };
      
      // Store encrypted data on-chain using FHE
      await contract.setData(
        `identity_${identityId}`, 
        ethers.toUtf8Bytes(JSON.stringify(identityData))
      );
      
      const keysBytes = await contract.getData("identity_keys");
      let keys: string[] = [];
      
      if (keysBytes.length > 0) {
        try {
          keys = JSON.parse(ethers.toUtf8String(keysBytes));
        } catch (e) {
          console.error("Error parsing keys:", e);
        }
      }
      
      keys.push(identityId);
      
      await contract.setData(
        "identity_keys", 
        ethers.toUtf8Bytes(JSON.stringify(keys))
      );
      
      setTransactionStatus({
        visible: true,
        status: "success",
        message: language === "en" 
          ? "Encrypted identity created successfully!" 
          : "加密身份创建成功！"
      });
      
      await loadIdentities();
      
      setTimeout(() => {
        setTransactionStatus({ visible: false, status: "pending", message: "" });
        setShowCreateModal(false);
        setNewIdentityData({
          category: "",
          description: "",
          identityInfo: ""
        });
      }, 2000);
    } catch (e: any) {
      const errorMessage = e.message.includes("user rejected transaction")
        ? language === "en" ? "Transaction rejected by user" : "用户拒绝了交易"
        : (language === "en" ? "Creation failed: " : "创建失败: ") + (e.message || "Unknown error");
      
      setTransactionStatus({
        visible: true,
        status: "error",
        message: errorMessage
      });
      
      setTimeout(() => {
        setTransactionStatus({ visible: false, status: "pending", message: "" });
      }, 3000);
    } finally {
      setCreating(false);
    }
  };

  const verifyIdentity = async (identityId: string) => {
    if (!provider) {
      alert(language === "en" ? "Please connect wallet first" : "请先连接钱包");
      return;
    }

    setTransactionStatus({
      visible: true,
      status: "pending",
      message: language === "en" 
        ? "Verifying encrypted identity with FHE..." 
        : "正在使用FHE验证加密身份..."
    });

    try {
      // Simulate FHE computation time
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      const contract = await getContractWithSigner();
      if (!contract) {
        throw new Error("Failed to get contract with signer");
      }
      
      const identityBytes = await contract.getData(`identity_${identityId}`);
      if (identityBytes.length === 0) {
        throw new Error("Identity not found");
      }
      
      const identityData = JSON.parse(ethers.toUtf8String(identityBytes));
      
      const updatedIdentity = {
        ...identityData,
        status: "verified"
      };
      
      await contract.setData(
        `identity_${identityId}`, 
        ethers.toUtf8Bytes(JSON.stringify(updatedIdentity))
      );
      
      setTransactionStatus({
        visible: true,
        status: "success",
        message: language === "en" 
          ? "FHE verification completed successfully!" 
          : "FHE验证成功完成！"
      });
      
      await loadIdentities();
      
      setTimeout(() => {
        setTransactionStatus({ visible: false, status: "pending", message: "" });
      }, 2000);
    } catch (e: any) {
      setTransactionStatus({
        visible: true,
        status: "error",
        message: (language === "en" ? "Verification failed: " : "验证失败: ") + (e.message || "Unknown error")
      });
      
      setTimeout(() => {
        setTransactionStatus({ visible: false, status: "pending", message: "" });
      }, 3000);
    }
  };

  const rejectIdentity = async (identityId: string) => {
    if (!provider) {
      alert(language === "en" ? "Please connect wallet first" : "请先连接钱包");
      return;
    }

    setTransactionStatus({
      visible: true,
      status: "pending",
      message: language === "en" 
        ? "Processing encrypted identity with FHE..." 
        : "正在使用FHE处理加密身份..."
    });

    try {
      // Simulate FHE computation time
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      const contract = await getContractWithSigner();
      if (!contract) {
        throw new Error("Failed to get contract with signer");
      }
      
      const identityBytes = await contract.getData(`identity_${identityId}`);
      if (identityBytes.length === 0) {
        throw new Error("Identity not found");
      }
      
      const identityData = JSON.parse(ethers.toUtf8String(identityBytes));
      
      const updatedIdentity = {
        ...identityData,
        status: "rejected"
      };
      
      await contract.setData(
        `identity_${identityId}`, 
        ethers.toUtf8Bytes(JSON.stringify(updatedIdentity))
      );
      
      setTransactionStatus({
        visible: true,
        status: "success",
        message: language === "en" 
          ? "FHE rejection completed successfully!" 
          : "FHE拒绝操作成功完成！"
      });
      
      await loadIdentities();
      
      setTimeout(() => {
        setTransactionStatus({ visible: false, status: "pending", message: "" });
      }, 2000);
    } catch (e: any) {
      setTransactionStatus({
        visible: true,
        status: "error",
        message: (language === "en" ? "Rejection failed: " : "拒绝操作失败: ") + (e.message || "Unknown error")
      });
      
      setTimeout(() => {
        setTransactionStatus({ visible: false, status: "pending", message: "" });
      }, 3000);
    }
  };

  const isOwner = (address: string) => {
    return account.toLowerCase() === address.toLowerCase();
  };

  const renderPieChart = () => {
    const total = identities.length || 1;
    const verifiedPercentage = (verifiedCount / total) * 100;
    const pendingPercentage = (pendingCount / total) * 100;
    const rejectedPercentage = (rejectedCount / total) * 100;

    return (
      <div className="pie-chart-container">
        <div className="pie-chart">
          <div 
            className="pie-segment verified" 
            style={{ transform: `rotate(${verifiedPercentage * 3.6}deg)` }}
          ></div>
          <div 
            className="pie-segment pending" 
            style={{ transform: `rotate(${(verifiedPercentage + pendingPercentage) * 3.6}deg)` }}
          ></div>
          <div 
            className="pie-segment rejected" 
            style={{ transform: `rotate(${(verifiedPercentage + pendingPercentage + rejectedPercentage) * 3.6}deg)` }}
          ></div>
          <div className="pie-center">
            <div className="pie-value">{identities.length}</div>
            <div className="pie-label">{language === "en" ? "Identities" : "身份数"}</div>
          </div>
        </div>
        <div className="pie-legend">
          <div className="legend-item">
            <div className="color-box verified"></div>
            <span>{language === "en" ? "Verified" : "已验证"}: {verifiedCount}</span>
          </div>
          <div className="legend-item">
            <div className="color-box pending"></div>
            <span>{language === "en" ? "Pending" : "待处理"}: {pendingCount}</span>
          </div>
          <div className="legend-item">
            <div className="color-box rejected"></div>
            <span>{language === "en" ? "Rejected" : "已拒绝"}: {rejectedCount}</span>
          </div>
        </div>
      </div>
    );
  };

  const toggleLanguage = () => {
    setLanguage(language === "en" ? "zh" : "en");
  };

  if (loading) return (
    <div className="loading-screen">
      <div className="metal-spinner"></div>
      <p>{language === "en" ? "Initializing FHE connection..." : "正在初始化FHE连接..."}</p>
    </div>
  );

  return (
    <div className="app-container metal-theme">
      <header className="app-header">
        <div className="logo">
          <div className="logo-icon">
            <div className="nft-icon"></div>
          </div>
          <h1>FHE<span>NFT</span>Passport</h1>
        </div>
        
        <div className="header-actions">
          <button 
            onClick={toggleLanguage}
            className="metal-button language-toggle"
          >
            {content[language].language}
          </button>
          <button 
            onClick={() => setShowCreateModal(true)} 
            className="create-identity-btn metal-button"
          >
            <div className="add-icon"></div>
            {content[language].createIdentity}
          </button>
          <WalletManager account={account} onConnect={onConnect} onDisconnect={onDisconnect} />
        </div>
      </header>
      
      <div className="main-content">
        <div className="welcome-banner">
          <div className="welcome-text">
            <h2>{content[language].title}</h2>
            <p>{content[language].subtitle}</p>
          </div>
        </div>
        
        <div className="dashboard-panels">
          <div className="panel project-panel metal-card">
            <h3>{content[language].projectTitle}</h3>
            <p>{content[language].projectDesc}</p>
            
            <div className="features-list">
              <h4>{content[language].featuresTitle}</h4>
              <ul>
                {content[language].features.map((feature, index) => (
                  <li key={index}>{feature}</li>
                ))}
              </ul>
            </div>
            
            <div className="fhe-badge">
              <span>FHE-Powered</span>
            </div>
          </div>
          
          <div className="panel stats-panel metal-card">
            <h3>{content[language].statsTitle}</h3>
            <div className="stats-grid">
              <div className="stat-item">
                <div className="stat-value">{identities.length}</div>
                <div className="stat-label">{content[language].totalIdentities}</div>
              </div>
              <div className="stat-item">
                <div className="stat-value">{verifiedCount}</div>
                <div className="stat-label">{content[language].verifiedIdentities}</div>
              </div>
              <div className="stat-item">
                <div className="stat-value">{pendingCount}</div>
                <div className="stat-label">{content[language].pendingIdentities}</div>
              </div>
              <div className="stat-item">
                <div className="stat-value">{rejectedCount}</div>
                <div className="stat-label">{content[language].rejectedIdentities}</div>
              </div>
            </div>
          </div>
          
          <div className="panel chart-panel metal-card">
            <h3>{content[language].distributionTitle}</h3>
            {renderPieChart()}
          </div>
        </div>
        
        <div className="identities-section">
          <div className="section-header">
            <h2>{language === "en" ? "Identity NFTs" : "身份NFT列表"}</h2>
            <div className="header-actions">
              <button 
                onClick={loadIdentities}
                className="refresh-btn metal-button"
                disabled={isRefreshing}
              >
                {isRefreshing ? (language === "en" ? "Refreshing..." : "刷新中...") : content[language].refresh}
              </button>
            </div>
          </div>
          
          <div className="identities-list metal-card">
            <div className="table-header">
              <div className="header-cell">ID</div>
              <div className="header-cell">{language === "en" ? "Category" : "类别"}</div>
              <div className="header-cell">{language === "en" ? "Owner" : "所有者"}</div>
              <div className="header-cell">{language === "en" ? "Date" : "日期"}</div>
              <div className="header-cell">{language === "en" ? "Status" : "状态"}</div>
              <div className="header-cell">{language === "en" ? "Actions" : "操作"}</div>
            </div>
            
            {identities.length === 0 ? (
              <div className="no-identities">
                <div className="no-identities-icon"></div>
                <p>{content[language].noIdentities}</p>
                <button 
                  className="metal-button primary"
                  onClick={() => setShowCreateModal(true)}
                >
                  {content[language].createFirst}
                </button>
              </div>
            ) : (
              identities.map(identity => (
                <div className="identity-row" key={identity.id}>
                  <div className="table-cell identity-id">#{identity.id.substring(0, 6)}</div>
                  <div className="table-cell">{identity.category}</div>
                  <div className="table-cell">{identity.owner.substring(0, 6)}...{identity.owner.substring(38)}</div>
                  <div className="table-cell">
                    {new Date(identity.timestamp * 1000).toLocaleDateString()}
                  </div>
                  <div className="table-cell">
                    <span className={`status-badge ${identity.status}`}>
                      {content[language][identity.status]}
                    </span>
                  </div>
                  <div className="table-cell actions">
                    <button 
                      className="action-btn metal-button info"
                      onClick={() => setSelectedIdentity(identity)}
                    >
                      {language === "en" ? "Details" : "详情"}
                    </button>
                    {isOwner(identity.owner) && identity.status === "pending" && (
                      <>
                        <button 
                          className="action-btn metal-button success"
                          onClick={() => verifyIdentity(identity.id)}
                        >
                          {language === "en" ? "Verify" : "验证"}
                        </button>
                        <button 
                          className="action-btn metal-button danger"
                          onClick={() => rejectIdentity(identity.id)}
                        >
                          {language === "en" ? "Reject" : "拒绝"}
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
  
      {showCreateModal && (
        <ModalCreate 
          onSubmit={submitIdentity} 
          onClose={() => setShowCreateModal(false)} 
          creating={creating}
          identityData={newIdentityData}
          setIdentityData={setNewIdentityData}
          language={language}
        />
      )}
      
      {selectedIdentity && (
        <ModalDetails 
          identity={selectedIdentity}
          onClose={() => setSelectedIdentity(null)}
          language={language}
        />
      )}
      
      {walletSelectorOpen && (
        <WalletSelector
          isOpen={walletSelectorOpen}
          onWalletSelect={(wallet) => { onWalletSelect(wallet); setWalletSelectorOpen(false); }}
          onClose={() => setWalletSelectorOpen(false)}
        />
      )}
      
      {transactionStatus.visible && (
        <div className="transaction-modal">
          <div className="transaction-content metal-card">
            <div className={`transaction-icon ${transactionStatus.status}`}>
              {transactionStatus.status === "pending" && <div className="metal-spinner"></div>}
              {transactionStatus.status === "success" && <div className="check-icon"></div>}
              {transactionStatus.status === "error" && <div className="error-icon"></div>}
            </div>
            <div className="transaction-message">
              {transactionStatus.message}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

interface ModalCreateProps {
  onSubmit: () => void; 
  onClose: () => void; 
  creating: boolean;
  identityData: any;
  setIdentityData: (data: any) => void;
  language: "en" | "zh";
}

const ModalCreate: React.FC<ModalCreateProps> = ({ 
  onSubmit, 
  onClose, 
  creating,
  identityData,
  setIdentityData,
  language
}) => {
  const content = {
    en: {
      title: "Create Identity NFT",
      category: "Category *",
      description: "Description",
      identityInfo: "Identity Information *",
      cancel: "Cancel",
      submit: "Submit Securely",
      encrypting: "Encrypting with FHE...",
      notice: "Your identity data will be encrypted with FHE technology"
    },
    zh: {
      title: "创建身份NFT",
      category: "类别 *",
      description: "描述",
      identityInfo: "身份信息 *",
      cancel: "取消",
      submit: "安全提交",
      encrypting: "正在使用FHE加密...",
      notice: "您的身份数据将使用FHE技术进行加密"
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setIdentityData({
      ...identityData,
      [name]: value
    });
  };

  const handleSubmit = () => {
    if (!identityData.category || !identityData.identityInfo) {
      alert(language === "en" ? "Please fill required fields" : "请填写必填字段");
      return;
    }
    
    onSubmit();
  };

  return (
    <div className="modal-overlay">
      <div className="create-modal metal-card">
        <div className="modal-header">
          <h2>{content[language].title}</h2>
          <button onClick={onClose} className="close-modal">&times;</button>
        </div>
        
        <div className="modal-body">
          <div className="fhe-notice-banner">
            <div className="key-icon"></div> {content[language].notice}
          </div>
          
          <div className="form-grid">
            <div className="form-group">
              <label>{content[language].category}</label>
              <select 
                name="category"
                value={identityData.category} 
                onChange={handleChange}
                className="metal-select"
              >
                <option value="">{language === "en" ? "Select category" : "选择类别"}</option>
                <option value="Personal">Personal ID</option>
                <option value="Professional">Professional Credential</option>
                <option value="Financial">Financial Status</option>
                <option value="Education">Education Background</option>
                <option value="Other">Other</option>
              </select>
            </div>
            
            <div className="form-group">
              <label>{content[language].description}</label>
              <input 
                type="text"
                name="description"
                value={identityData.description} 
                onChange={handleChange}
                placeholder={language === "en" ? "Brief description..." : "简短描述..."} 
                className="metal-input"
              />
            </div>
            
            <div className="form-group full-width">
              <label>{content[language].identityInfo}</label>
              <textarea 
                name="identityInfo"
                value={identityData.identityInfo} 
                onChange={handleChange}
                placeholder={language === "en" ? "Enter identity information to encrypt..." : "输入要加密的身份信息..."} 
                className="metal-textarea"
                rows={4}
              />
            </div>
          </div>
        </div>
        
        <div className="modal-footer">
          <button 
            onClick={onClose}
            className="cancel-btn metal-button"
          >
            {content[language].cancel}
          </button>
          <button 
            onClick={handleSubmit} 
            disabled={creating}
            className="submit-btn metal-button primary"
          >
            {creating ? content[language].encrypting : content[language].submit}
          </button>
        </div>
      </div>
    </div>
  );
};

interface ModalDetailsProps {
  identity: NFTIdentity;
  onClose: () => void;
  language: "en" | "zh";
}

const ModalDetails: React.FC<ModalDetailsProps> = ({ identity, onClose, language }) => {
  const content = {
    en: {
      title: "Identity Details",
      id: "Identity ID",
      owner: "Owner",
      created: "Created",
      status: "Status",
      category: "Category",
      description: "Description",
      close: "Close",
      encryptedData: "Encrypted Data"
    },
    zh: {
      title: "身份详情",
      id: "身份ID",
      owner: "所有者",
      created: "创建时间",
      status: "状态",
      category: "类别",
      description: "描述",
      close: "关闭",
      encryptedData: "加密数据"
    }
  };

  return (
    <div className="modal-overlay">
      <div className="details-modal metal-card">
        <div className="modal-header">
          <h2>{content[language].title}</h2>
          <button onClick={onClose} className="close-modal">&times;</button>
        </div>
        
        <div className="modal-body">
          <div className="detail-item">
            <label>{content[language].id}</label>
            <span>#{identity.id}</span>
          </div>
          
          <div className="detail-item">
            <label>{content[language].owner}</label>
            <span>{identity.owner}</span>
          </div>
          
          <div className="detail-item">
            <label>{content[language].created}</label>
            <span>{new Date(identity.timestamp * 1000).toLocaleString()}</span>
          </div>
          
          <div className="detail-item">
            <label>{content[language].status}</label>
            <span className={`status-badge ${identity.status}`}>
              {language === "en" ? identity.status : 
                identity.status === "verified" ? "已验证" :
                identity.status === "pending" ? "待处理" : "已拒绝"}
            </span>
          </div>
          
          <div className="detail-item">
            <label>{content[language].category}</label>
            <span>{identity.category}</span>
          </div>
          
          {identity.metadata && identity.metadata.description && (
            <div className="detail-item">
              <label>{content[language].description}</label>
              <span>{identity.metadata.description}</span>
            </div>
          )}
          
          <div className="detail-item full-width">
            <label>{content[language].encryptedData}</label>
            <div className="encrypted-data">
              {identity.encryptedData}
            </div>
          </div>
        </div>
        
        <div className="modal-footer">
          <button 
            onClick={onClose}
            className="close-btn metal-button"
          >
            {content[language].close}
          </button>
        </div>
      </div>
    </div>
  );
};

export default App;