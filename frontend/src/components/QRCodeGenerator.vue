<template>
  <v-card class="mt-4" elevation="2">
    <v-card-title>活動 QR 碼</v-card-title>
    <v-card-text>
      <p>任務 ID: {{ taskId }}</p>
      <div v-if="qrCodeUrl" class="text-center">
        <img :src="qrCodeUrl" alt="QR Code" style="max-width: 200px;" />
        <br />
        <v-btn color="primary" @click="downloadQRCode" class="mt-2">下載 QR 碼</v-btn>
      </div>
      <div v-else>
        生成中...
      </div>
    </v-card-text>
  </v-card>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import QRCode from 'qrcode'

const props = defineProps({
  taskId: {
    type: Number,
    required: true
  }
})

const qrCodeUrl = ref('')

onMounted(async () => {
  try {
    // 生成 QR code，內容是任務 ID
    qrCodeUrl.value = await QRCode.toDataURL(props.taskId.toString())
  } catch (err) {
    console.error('生成 QR code 失敗:', err)
  }
})

function downloadQRCode() {
  if (!qrCodeUrl.value) return

  const link = document.createElement('a')
  link.href = qrCodeUrl.value
  link.download = `task-${props.taskId}-qrcode.png`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}
</script>