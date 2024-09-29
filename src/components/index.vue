<script setup>
import {ref} from 'vue'
import Group from "../com/service/Group";

const currUser = ref(null);
const group = new Group('online');
const otherUsers = ref([]);
const messages = ref([]);
const sendText = ref('');
const streams = ref([]);

const sendMessage = (text) => {
    messages.value.push(sendText.value);
    group.sendText(sendText.value)
    sendText.value = ''
}

const sharedScreen = async () => {
    const stream = await navigator.mediaDevices.getDisplayMedia({video: true, audio: false});
    group.addStream(stream)
}
const closeScreen = () => {

}
let cameraStream = null;
const openCamera = async () => {
    const stream = await navigator.mediaDevices.getUserMedia({video: true, audio: true});
    cameraStream = stream;
    group.addStream(stream)
}
const closeCamera = () => {
    cameraStream.getTracks().forEach(track => {
        track.stop(); // 停止视频轨道
    });
    group.removeStream(cameraStream)
    // cameraStream = null;
}
group.onConnect((userInfo) => {
    currUser.value = userInfo;
})
group.onJoin((userInfo) => {
    otherUsers.value.push(userInfo);
})
group.onLeave((userInfo) => {
    const index = otherUsers.value.findIndex(u => u.id === userInfo.id);
    if (index !== -1) {
        otherUsers.value.splice(index, 1);
        const number = streams.value.findIndex(s => s.userInfo.id === userInfo.id);
        if (number !== -1) {
            streams.value.splice(number, 1);
        }
    }
})

group.onMessage((message, userInfo) => {
    messages.value.push(message.getData());
})

group.onStream((stream, userInfo) => {
    streams.value.push({stream, userInfo});
})
group.onRemoveStream((stream, userInfo) => {
    const number = streams.value.findIndex(s => s.stream === stream);
    if (number !== -1) {
        streams.value.splice(number, 1);
    }
})
group.start();
// navigator.mediaDevices.getUserMedia({video: true, audio: false}).then(stream => {
//   group.localStream = stream;
//   group.start();
// }).catch(error => {
//   console.error('Error getting local stream: ', error)
//   group.start();
// })

</script>

<template>
    <div>
        <input v-model="sendText" placeholder="Enter message">
        <button @click="sendMessage">Send</button>
        <button @click="sharedScreen">屏幕共享</button>
        <button @click="closeScreen">关闭屏幕共享</button>
        <button @click="openCamera">打开摄像头</button>
        <button @click="closeCamera">关闭摄像头</button>
    </div>
    <div v-for="(user, index) in otherUsers">
        {{ user.name }}:{{ user.id }}
    </div>
    <hr>
    <div v-for="(message, index) in messages">
        {{ message }}
    </div>
    <div v-for="(item, index) in streams">
        <video autoplay muted :srcObject="item.stream"></video>
    </div>
</template>

<style scoped lang="scss">
</style>
