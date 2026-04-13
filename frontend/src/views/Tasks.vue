<template>
  <v-container>
    <v-card class="pa-4" elevation="2">
      <v-card-title>任務列表</v-card-title>
      <v-progress-linear v-if="loading" indeterminate></v-progress-linear>
      <div v-else>
        <v-data-table
          :headers="headers"
          :items="tasks"
          item-value="taskId"
          class="elevation-1"
        >
          <template #item.taskType="{ item }">
            <v-chip :color="getTaskTypeColor(item.taskType)" size="small" class="text-white">
              {{ getTaskTypeName(item.taskType) }}
            </v-chip>
          </template>
          <template #item.description="{ item }">
            <span>{{ item.description }}</span>
          </template>
          <template #item.reward="{ item }">
            {{ formatToken(item.reward) }} MTK
          </template>
          <template #item.progress="{ item }">
            <div v-if="item.taskType === 0">
              {{ formatToken(item.userConsumption) }} / {{ formatToken(item.targetAmount) }}
            </div>
            <div v-else>
              {{ item.currentClaims }} / {{ item.maxClaims }}
            </div>
          </template>
          <template #item.status="{ item }">
            <v-chip
              :color="getTaskStatusColor(item)"
              size="small"
              class="text-white"
            >
              {{ getTaskStatusLabel(item) }}
            </v-chip>
          </template>
          <template #item.actions="{ item }">
            <v-row class="g-2" align="center" no-gutters>
              <v-col cols="auto">
                <v-btn 
                  v-if="item.exists && item.taskType === 0 && !item.userClaimed && item.canClaim"
                  size="small" 
                  color="primary"
                  @click="claimTask(item.taskId)"
                  :loading="claimingId === item.taskId">
                  領取獎勵
                </v-btn>
                <v-btn
                  v-else-if="item.exists && item.taskType === 2 && !item.userClaimed && item.currentClaims < item.maxClaims"
                  size="small"
                  color="primary"
                  @click="scannerTaskId = item.taskId"
                >
                  掃描領取
                </v-btn>
                <span v-else-if="item.userClaimed" class="text-success">✓ 已領</span>
                <span v-else class="text-grey">不可領</span>
              </v-col>
              <v-col cols="auto" v-if="item.taskType === 2 && walletStore.currentRole === 3">
                <v-btn
                  size="small"
                  color="secondary"
                  @click="showQRCode(item.taskId)"
                >
                  查看 QR Code
                </v-btn>
              </v-col>
            </v-row>
          </template>
        </v-data-table>
        <v-alert v-if="successMsg" type="success" class="mt-4">{{ successMsg }}</v-alert>
        <v-alert v-if="errorMsg" type="error" class="mt-4">{{ errorMsg }}</v-alert>

        <div v-if="selectedQRCodeTaskId !== null" class="mt-4">
          <QRCodeGenerator :taskId="selectedQRCodeTaskId" />
          <v-btn color="secondary" class="mt-2" @click="selectedQRCodeTaskId = null">關閉 QR Code</v-btn>
        </div>

        <div v-if="scannerTaskId !== null" class="mt-4">
          <QRCodeScanner />
          <v-btn color="secondary" class="mt-2" @click="scannerTaskId = null">關閉掃描器</v-btn>
        </div>
      </div>
    </v-card>
  </v-container>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useWalletStore } from '@/store/walletStore'
import { ethers } from 'ethers'
import { CONTRACT_ADDRESSES } from '@/contracts/addresses'
import taskRewardABI from '@/abi/TaskReward.json'
import paymentABI from '@/abi/Payment.json'
import QRCodeGenerator from '@/components/QRCodeGenerator.vue'
import QRCodeScanner from '@/components/QRCodeScanner.vue'

const headers = ref([
  { title: '任務編號', key: 'taskId', width: '80px' },
  { title: '類型', key: 'taskType', width: '100px' },
  { title: '任務名稱', key: 'description' },
  { title: '獎勵', key: 'reward', width: '100px' },
  { title: '進度', key: 'progress', width: '120px' },
  { title: '狀態', key: 'status', width: '100px' },
  { title: '操作', key: 'actions', width: '120px' },
])

const walletStore = useWalletStore()
const tasks = ref([])
const loading = ref(false)
const claimingId = ref(null)
const selectedQRCodeTaskId = ref(null)
const scannerTaskId = ref(null)
const successMsg = ref('')
const errorMsg = ref('')

const TASK_TYPES = {
  0: { name: '消費', color: 'success' },
  1: { name: '問卷', color: 'info' },
  2: { name: '活動', color: 'warning' },
}

function getTaskTypeName(type) {
  return TASK_TYPES[Number(type)]?.name || '未知'
}

function getTaskTypeColor(type) {
  return TASK_TYPES[Number(type)]?.color || 'grey'
}

function getTaskStatusLabel(item) {
  if (item.userClaimed) return '已領取'

  if (item.canClaim) {
    if (item.taskType === 2) return '掃描領取'
    return '可領取'
  }

  if (item.taskType === 0) return '尚未達標'
  if (item.taskType === 2) return '等待掃描'
  return '不可領'
}

function getTaskStatusColor(item) {
  if (item.userClaimed) return 'green'
  if (item.canClaim) return item.taskType === 2 ? 'warning' : 'orange'
  return 'grey'
}

function formatToken(wei) {
  if (wei === null || wei === undefined) return '0.00'
  return Number(ethers.formatUnits(wei, 18)).toFixed(2)
}

const loadTasks = async () => {
  loading.value = true
  successMsg.value = ''
  errorMsg.value = ''
  try {
    if (!window.ethereum) throw new Error('請安裝 MetaMask')

    const provider = new ethers.BrowserProvider(window.ethereum)
    const signer = await provider.getSigner()
    const userAddress = await signer.getAddress()

    const taskRewardContract = new ethers.Contract(
      CONTRACT_ADDRESSES.taskReward,
      taskRewardABI.abi,
      provider
    )
    const paymentContract = new ethers.Contract(
      CONTRACT_ADDRESSES.payment,
      paymentABI.abi,
      provider
    )

    const nextId = await taskRewardContract.nextTaskId()
    const taskList = []

    for (let i = 0; i < nextId; i++) {
      const task = await taskRewardContract.getTask(i)
      // 新的 getTask 回傳順序: taskType[0], description[1], reward[2], maxClaims[3], currentClaims[4], targetAmount[5], createdBy[6], createdAt[7], exists[8]
      const [taskType, description, reward, maxClaims, currentClaims, targetAmount, createdBy, createdAt, exists] = task
      const numericTaskType = Number(taskType)

      // 過濾已取消的任務
      if (!exists) continue

      const userClaimed = await taskRewardContract.hasUserClaimed(i, userAddress)

      // 對消費任務，查詢用戶的累積消費
      let userConsumption = BigInt(0)
      let canClaim = false

      if (numericTaskType === 0) {
        // Consumer 類型
        userConsumption = await paymentContract.getTotalPaidFromTo(userAddress, createdBy)
        canClaim = userConsumption >= targetAmount && !userClaimed
      } else {
        // Survey 或 Event 類型
        canClaim = !userClaimed && currentClaims < maxClaims
      }

      taskList.push({
        taskId: i,
        taskType: numericTaskType,
        description,
        reward,
        maxClaims: Number(maxClaims),
        currentClaims: Number(currentClaims),
        targetAmount,
        createdBy,
        createdAt: Number(createdAt),
        exists,
        userClaimed,
        userConsumption,
        canClaim,
      })
    }

    tasks.value = taskList
  } catch (err) {
    errorMsg.value = '❌ 任務讀取失敗：' + (err?.shortMessage || err.message)
    console.error(err)
  } finally {
    loading.value = false
  }
}

const claimTask = async (taskId) => {
  claimingId.value = taskId
  successMsg.value = ''
  errorMsg.value = ''
  try {
    if (!window.ethereum) throw new Error('請安裝 MetaMask')

    const provider = new ethers.BrowserProvider(window.ethereum)
    const signer = await provider.getSigner()
    const taskRewardContract = new ethers.Contract(
      CONTRACT_ADDRESSES.taskReward,
      taskRewardABI.abi,
      signer
    )

    const tx = await taskRewardContract.completeTask(taskId)
    await tx.wait()

    successMsg.value = `✅ 成功領取任務 #${taskId} 的獎勵！`
    await loadTasks() // 重新載入任務列表
  } catch (err) {
    errorMsg.value = '❌ 領取失敗：' + (err?.shortMessage || err.message)
    console.error(err)
  } finally {
    claimingId.value = null
  }
}

function showQRCode(taskId) {
  selectedQRCodeTaskId.value = taskId
}

onMounted(loadTasks)
</script>
