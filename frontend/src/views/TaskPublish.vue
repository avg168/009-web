<template>
  <v-container>
    <v-card class="pa-4" elevation="2" max-width="500" mx="auto">
      <v-card-title>發布新任務</v-card-title>
      <v-card-text>
        <v-form @submit.prevent="publishTask">
          <v-text-field v-model="taskName" label="任務名稱" required></v-text-field>
          <v-radio-group v-model="taskType" label="任務類型" row>
            <v-radio label="消費" value="0"></v-radio>
            <v-radio label="問卷填寫" value="1"></v-radio>
            <v-radio label="參與活動" value="2"></v-radio>
          </v-radio-group>
          <v-text-field 
            v-if="taskType === '0'" 
            v-model.number="targetAmount" 
            label="消費目標金額 (MTK)" 
            type="number" 
            min="1" 
            required>
          </v-text-field>
          <v-text-field 
            v-model="desc" 
            :label="taskType === '0' ? '任務內容（可補充說明）' : '任務內容'" 
            required>
          </v-text-field>
          <v-text-field v-model.number="reward" label="獎勵金額 (MTK)" type="number" min="1" required></v-text-field>
          <v-text-field v-model.number="maxClaims" label="可領取人數" type="number" min="1" required></v-text-field>
          <v-btn type="submit" color="primary" :loading="loading">發布任務</v-btn>
        </v-form>
        <v-alert v-if="successMsg" type="success" class="mt-2">{{ successMsg }}</v-alert>
        <v-alert v-if="errorMsg" type="error" class="mt-2">{{ errorMsg }}</v-alert>
        <!-- 顯示 QR Code 給 Event 任務 -->
        <QRCodeGenerator v-if="taskType === '2' && publishedTaskId !== null" :taskId="publishedTaskId" />
      </v-card-text>
    </v-card>
  </v-container>
</template>

<script setup>
import { ref } from 'vue'
import { ethers } from 'ethers'
import { CONTRACT_ADDRESSES } from '@/contracts/addresses'
import taskRewardABI from '@/abi/TaskReward.json'
import myTokenABI from '@/abi/MyToken.json'
import QRCodeGenerator from '@/components/QRCodeGenerator.vue'

const taskName = ref('')
const taskType = ref('0')
const desc = ref('')
const targetAmount = ref(0)
const reward = ref(1)
const maxClaims = ref(1)
const loading = ref(false)
const successMsg = ref('')
const errorMsg = ref('')
const publishedTaskId = ref(null)

async function publishTask() {
  loading.value = true
  successMsg.value = ''
  errorMsg.value = ''
  try {
    if (!window.ethereum) throw new Error('請安裝 MetaMask')
    const provider = new ethers.BrowserProvider(window.ethereum)
    const signer = await provider.getSigner()

    const decimals = 18
    const rewardWei = ethers.parseUnits(reward.value.toString(), decimals)
    const totalAmount = rewardWei * BigInt(maxClaims.value)
    
    // 消費目標金額（wei）；非 Consumer 類型設 0
    let targetAmountWei = BigInt(0)
    if (taskType.value === '0') {
      targetAmountWei = ethers.parseUnits(targetAmount.value.toString(), decimals)
    }

    // Step 1: Approve token 給 TaskReward（escrow）
    console.log('Approving token...')
    const tokenContract = new ethers.Contract(CONTRACT_ADDRESSES.token, myTokenABI.abi, signer)
    const approveTx = await tokenContract.approve(CONTRACT_ADDRESSES.taskReward, totalAmount)
    await approveTx.wait()
    console.log('Approve confirmed')

    // Step 2: 呼叫 createTask（新簽名）
    console.log('Creating task...')
    const taskRewardContract = new ethers.Contract(CONTRACT_ADDRESSES.taskReward, taskRewardABI.abi, signer)
    const tx = await taskRewardContract.createTask(
      parseInt(taskType.value),     // taskType: 0=Consumer, 1=Survey, 2=Event
      taskName.value,               // description（簡化為只存任務名稱）
      rewardWei,                    // reward (wei)
      maxClaims.value,              // maxClaims
      targetAmountWei               // targetAmount (wei)
    )
    await tx.wait()

    // 獲取任務 ID（nextTaskId - 1）
    const nextTaskId = await taskRewardContract.nextTaskId()
    publishedTaskId.value = Number(nextTaskId) - 1

    successMsg.value = '✅ 任務已成功發布！'
    taskName.value = ''
    taskType.value = '0'
    desc.value = ''
    reward.value = 1
    maxClaims.value = 1
    targetAmount.value = 0
  } catch (err) {
    errorMsg.value = '❌ 發布失敗：' + (err?.shortMessage || err.message)
    console.error(err)
  } finally {
    loading.value = false
  }
}
</script>
