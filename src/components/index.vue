<script setup>
import {ref} from 'vue'
import Group from "../com/service/Group";

const currUser = ref(null);
const group = new Group('online');
const otherUsers = ref([]);
const messages = ref([]);
const sendText = ref('');

const sendMessage = (text) => {
    messages.value.push(sendText.value);
    group.sendText(sendText.value)
    sendText.value = ''
}

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

group.start();
</script>

<template>
    <div>
        <input v-model="sendText" placeholder="Enter message">
        <button @click="sendMessage">Send</button>
    </div>
    <div v-for="(user, index) in otherUsers">
        {{ user.name }}:{{ user.id }}
    </div>
    <hr>
    <div v-for="(message, index) in messages">
        {{ message }}
    </div>
</template>

<style scoped lang="scss">
</style>
