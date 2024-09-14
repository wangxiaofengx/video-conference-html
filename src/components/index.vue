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

const sharedScreen = () => {
    navigator.mediaDevices.getUserMedia({video: true, audio: true})
        // navigator.mediaDevices.getDisplayMedia({ video: true })
        .then(stream => {
            group.shareScreen(stream)
            // sharedScreenVideo.value.srcObject = stream;
        }).catch(error => console.error('Error sharing screen: ', error))
}
group.onTrack((message) => {
    // messages.value.push(JSON.stringify(message));
})
group.onConnect((userInfo) => {
    currUser.value = userInfo;
})
group.onJoin((userInfo) => {
    otherUsers.value.push(userInfo);
})
group.onLeave((userInfo) => {
    const index = otherUsers.value.findIndex(u => u.id === userInfo.id);
    if (index >= 0) {
        otherUsers.value.splice(index, 1);
    }
})

group.onMessage((message) => {
    messages.value.push(message.getData());
})

group.onSharedScreen(stream => {
    streams.value.push(stream);
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
        <button @click="sharedScreen">Shared screen</button>
    </div>
    <div v-for="(user, index) in otherUsers">
        {{ user.name }}:{{ user.id }}
    </div>
    <hr>
    <div v-for="(message, index) in messages">
        {{ message }}
    </div>
    <div v-for="(stream, index) in streams">
        <video autoplay muted :srcObject="stream"></video>
    </div>
</template>

<style scoped lang="scss">
</style>
