//wallet.Store.js
import { defineStore } from 'pinia'
import { ethers } from 'ethers'
import { CONTRACT_ADDRESSES } from '@/contracts/addresses'
import userRoleABI from '@/abi/UserRole.json'
import myTokenABI from '@/abi/MyToken.json'

const MTK_ADDRESS = CONTRACT_ADDRESSES.token
const USER_ROLE_ADDRESS = CONTRACT_ADDRESSES.userRole
const MTK_ABI = myTokenABI.abi
const USER_ROLE_ABI = userRoleABI.abi

export const useWalletStore = defineStore('wallet', {
  state: () => ({
    account: null,
    balance: '0',
    transactionHistory: [],
    mtkTransfers: [],
    currentRole: null
  }),
  actions: {
    async connectWallet() {
      if (window.ethereum) {
        const provider = new ethers.BrowserProvider(window.ethereum)
        const accounts = await provider.send('eth_requestAccounts', [])
        this.account = accounts[0]
        await this.getBalance()
      } else {
        alert('請安裝 MetaMask')
      }
    },

    async getBalance() {
      if (this.account) {
        const provider = new ethers.BrowserProvider(window.ethereum)
        const balance = await provider.getBalance(this.account)
        this.balance = ethers.formatEther(balance)
      }
    },
    async getTransactionHistory() {
      const provider = new ethers.BrowserProvider(window.ethereum)
      const latestBlock = await provider.getBlockNumber()
      const START_BLOCK = Math.max(0, latestBlock - 100)
      const history = []

      for (let i = latestBlock; i >= START_BLOCK; i--) {
        const block = await provider.send("eth_getBlockByNumber", [
          ethers.toBeHex(i),
          true
        ])

        if (!block || !block.transactions) continue

        for (const tx of block.transactions) {
          if (
            tx.from?.toLowerCase() === this.account.toLowerCase() ||
            tx.to?.toLowerCase() === this.account.toLowerCase()
          ) {
            history.push({
              hash: tx.hash,
              from: tx.from,
              to: tx.to,
              value: ethers.formatEther(tx.value),
              blockNumber: parseInt(block.number)
            })
          }
        }
      }

      this.transactionHistory = history
      return history
    },
    async getMTKTransfers() {
      if (!this.account) return [];
      const provider = new ethers.BrowserProvider(window.ethereum);
      const token = new ethers.Contract(MTK_ADDRESS, MTK_ABI, provider);
      const decimals = await token.decimals();

      const latestBlock = await provider.getBlockNumber();
      const fromBlock = Math.max(0, latestBlock - 10000);

      const filterFrom = token.filters.Transfer(this.account, null);
      const logsFrom = await token.queryFilter(filterFrom, fromBlock, latestBlock);

      const filterTo = token.filters.Transfer(null, this.account);
      const logsTo = await token.queryFilter(filterTo, fromBlock, latestBlock);

      const allLogs = [...logsFrom, ...logsTo].sort((a, b) => b.blockNumber - a.blockNumber);
      const seen = new Set();
      const transfers = allLogs.filter(log => {
        const key = log.transactionHash + log.logIndex;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      }).map(log => ({
        from: log.args.from,
        to: log.args.to,
        value: ethers.formatUnits(log.args.value, decimals)
      }));

      this.mtkTransfers = transfers;
      return transfers;
    },
    getTotalMTKSpent() {
      return this.mtkTransfers
        ?.reduce((sum, tx) => sum + parseFloat(tx.value), 0)
        ?.toFixed(4) || '0';
    },
    async getMTKBalance() {
      if (!this.account) return "0";
      try {
        const provider = new ethers.BrowserProvider(window.ethereum);
        const token = new ethers.Contract(MTK_ADDRESS, MTK_ABI, provider);
        const decimals = await token.decimals();
        const balance = await token.balanceOf(this.account);
        return ethers.formatUnits(balance, decimals);
      } catch (err) {
        console.error('Error fetching MTK balance:', err);
        return "0";
      }
    },
    getTotalSpent() {
      return this.transactionHistory
        ?.filter(tx => tx.from?.toLowerCase() === this.account.toLowerCase())
        ?.reduce((sum, tx) => sum + parseFloat(tx.value), 0)
        ?.toFixed(4) || '0'
    },
    async fetchCurrentRole() {
      if (!this.account) {
        this.currentRole = null;
        return null;
      }
      try {
        const provider = new ethers.BrowserProvider(window.ethereum);
        const contract = new ethers.Contract(USER_ROLE_ADDRESS, USER_ROLE_ABI, provider);
        const role = await contract.getRole(this.account);
        this.currentRole = Number(role);
        console.log('Current role:', this.currentRole);
        return this.currentRole;
      } catch (err) {
        console.error('Error fetching role:', err);
        this.currentRole = null;
        return null;
      }
    },
  }
})