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

          <div v-if="taskType === '1'" class="survey-builder mb-4">
            <v-card class="pa-4 mb-4" elevation="1">
              <v-card-title class="text-h6">問卷問題設定</v-card-title>
              <v-card-text>
                <div v-if="surveyQuestions.length === 0" class="mb-4">
                  <p>請新增至少一題問卷問題，學生才能填寫。</p>
                </div>
                <div v-for="(question, index) in surveyQuestions" :key="index" class="mb-4 pa-4" style="border: 1px solid #e0e0e0; border-radius: 10px;">
                  <div class="d-flex justify-space-between align-center mb-3">
                    <div class="text-subtitle-2">問題 {{ index + 1 }}</div>
                    <v-btn icon color="error" @click="removeSurveyQuestion(index)">
                      <v-icon icon="mdi-close"></v-icon>
                    </v-btn>
                  </div>

                  <v-text-field v-model="question.label" label="問題文字" required />

                  <v-select
                    v-model="question.type"
                    :items="questionTypes"
                    label="題型"
                    item-title="label"
                    item-value="value"
                    required
                  />

                  <v-switch v-model="question.required" label="是否必填" class="mt-3" />

                  <div v-if="question.type !== 'text'" class="mt-3">
                    <div class="mb-2">選項</div>
                    <div v-for="(option, optionIndex) in question.options" :key="optionIndex" class="d-flex align-center mb-2">
                      <v-text-field
                        class="flex-grow-1"
                        v-model="question.options[optionIndex]"
                        :label="`選項 ${optionIndex + 1}`"
                        required
                      />
                      <v-btn icon color="error" @click="removeSurveyOption(index, optionIndex)">
                        <v-icon icon="mdi-close"></v-icon>
                      </v-btn>
                    </div>
                    <v-btn text color="primary" @click="addSurveyOption(index)">新增選項</v-btn>
                  </div>
                </div>
                <v-btn color="primary" text @click="addSurveyQuestion">新增問卷題目</v-btn>
              </v-card-text>
            </v-card>
          </div>

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
const surveyQuestions = ref([])
const loading = ref(false)
const successMsg = ref('')
const errorMsg = ref('')
const publishedTaskId = ref(null)
const questionTypes = ref([
  { label: '單選題', value: 'single' },
  { label: '多選題', value: 'multiple' },
  { label: '文字填寫', value: 'text' },
])

function addSurveyQuestion() {
  surveyQuestions.value.push({
    label: '',
    type: 'single',
    required: true,
    options: ['選項 1', '選項 2'],
  })
}

function removeSurveyQuestion(index) {
  surveyQuestions.value.splice(index, 1)
}

function addSurveyOption(questionIndex) {
  const question = surveyQuestions.value[questionIndex]
  if (!question) return
  question.options.push(`選項 ${question.options.length + 1}`)
}

function removeSurveyOption(questionIndex, optionIndex) {
  const question = surveyQuestions.value[questionIndex]
  if (!question || question.options.length <= 2) return
  question.options.splice(optionIndex, 1)
}

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

    let contractDescription = desc.value || taskName.value
    if (taskType.value === '1') {
      if (surveyQuestions.value.length === 0) {
        throw new Error('請新增至少一個問卷問題。')
      }
      surveyQuestions.value.forEach((question, index) => {
        if (!question.label || question.label.trim() === '') {
          throw new Error(`第 ${index + 1} 題問題文字不可為空。`)
        }
        if (question.type !== 'text') {
          if (!question.options || question.options.length < 2) {
            throw new Error(`第 ${index + 1} 題至少要有兩個選項。`)
          }
          question.options.forEach((option, optionIndex) => {
            if (!option || option.trim() === '') {
              throw new Error(`第 ${index + 1} 題的第 ${optionIndex + 1} 個選項不可為空。`)
            }
          })
        }
      })
      contractDescription = JSON.stringify({
        title: taskName.value,
        description: desc.value,
        questions: surveyQuestions.value,
      })
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
      contractDescription,          // description: task title / survey schema JSON
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
    surveyQuestions.value = []
  } catch (err) {
    errorMsg.value = '❌ 發布失敗：' + (err?.shortMessage || err.message)
    console.error(err)
  } finally {
    loading.value = false
  }
}
</script>
