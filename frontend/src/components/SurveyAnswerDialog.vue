<template>
  <v-dialog v-model="localOpen" max-width="700">
    <v-card>
      <v-card-title class="text-h6">{{ survey?.title || '問卷任務' }}</v-card-title>
      <v-card-text>
        <div v-if="!survey">
          <v-alert type="error">無法讀取問卷內容，請重新整理後再試。</v-alert>
        </div>

        <div v-else>
          <p class="mb-4">{{ survey.description || '請回答以下問卷問題。' }}</p>
          <div v-for="(question, index) in survey.questions" :key="index" class="mb-4 pa-3" style="border: 1px solid #e0e0e0; border-radius: 8px;">
            <div class="d-flex justify-space-between align-center mb-2">
              <div>
                <span class="text-subtitle-1">{{ index + 1 }}. {{ question.label }}</span>
                <span v-if="question.required" class="text-error">*</span>
              </div>
            </div>

            <div v-if="question.type === 'single'">
              <v-radio-group v-model="responses[index]" row>
                <v-radio
                  v-for="(option, optionIndex) in question.options"
                  :key="optionIndex"
                  :label="option"
                  :value="option"
                />
              </v-radio-group>
            </div>

            <div v-else-if="question.type === 'multiple'">
              <v-checkbox
                v-for="(option, optionIndex) in question.options"
                :key="optionIndex"
                :label="option"
                :value="option"
                v-model="responses[index]"
              />
            </div>

            <div v-else>
              <v-textarea
                v-model="responses[index]"
                :label="question.required ? '請填寫（必填）' : '請填寫（選填）'"
                rows="3"
              />
            </div>
          </div>

          <v-alert v-if="errorMsg" type="error" class="mb-4">{{ errorMsg }}</v-alert>
        </div>
      </v-card-text>

      <v-card-actions>
        <v-spacer />
        <v-btn text @click="close">取消</v-btn>
        <v-btn color="primary" :loading="submitting" @click="submit">提交問卷並領取</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup>
import { ref, watch } from 'vue'
import { useWalletStore } from '@/store/walletStore'

const props = defineProps({
  modelValue: Boolean,
  survey: Object,
  taskId: Number,
})
const emit = defineEmits(['update:modelValue', 'submitted'])

const localOpen = ref(props.modelValue)
const responses = ref({})
const errorMsg = ref('')
const submitting = ref(false)
const walletStore = useWalletStore()

watch(() => props.modelValue, (value) => {
  localOpen.value = value
})

watch(localOpen, (value) => {
  emit('update:modelValue', value)
})

watch(
  () => props.survey,
  (survey) => {
    if (survey) {
      initResponses(survey)
    }
  },
  { immediate: true }
)

function initResponses(survey) {
  responses.value = {}
  survey.questions?.forEach((question, index) => {
    if (question.type === 'multiple') {
      responses.value[index] = []
    } else {
      responses.value[index] = ''
    }
  })
  errorMsg.value = ''
}

function close() {
  localOpen.value = false
  errorMsg.value = ''
}

function validate() {
  if (!props.survey) {
    errorMsg.value = '問卷資料不存在。'
    return false
  }
  for (const [index, question] of props.survey.questions.entries()) {
    const answer = responses.value[index]
    if (question.required) {
      if (question.type === 'multiple') {
        if (!Array.isArray(answer) || answer.length === 0) {
          errorMsg.value = `問題 ${index + 1} 必須至少選擇一項。`
          return false
        }
      } else {
        if (!answer || String(answer).trim() === '') {
          errorMsg.value = `問題 ${index + 1} 不能留空。`
          return false
        }
      }
    }
  }
  return true
}

function saveAnswers() {
  const account = walletStore.account || 'unknown'
  const key = `survey_answers_task_${props.taskId}_${account}`
  localStorage.setItem(key, JSON.stringify({
    survey: props.survey,
    answers: responses.value,
    submittedAt: new Date().toISOString(),
  }))
}

async function submit() {
  if (!validate()) return
  submitting.value = true
  try {
    // 提交到後端
    const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000'
    const response = await fetch(`${backendUrl}/api/survey/submit`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        taskId: props.taskId,
        studentAddress: walletStore.account,
        answers: responses.value,
      }),
    })

    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(errorData.error || '提交失敗')
    }

    const result = await response.json()
    console.log('Survey submitted to backend:', result)

    saveAnswers()
    emit('submitted', { taskId: props.taskId, answers: responses.value })
    close()
  } catch (error) {
    console.error('Survey submit error:', error)
    errorMsg.value = '❌ 提交失敗：' + error.message
  } finally {
    submitting.value = false
  }
}
</script>
