<script setup>

</script>

<template>
    <nav>
        <RouterLink to="/demo">demo</RouterLink>
        <RouterLink to="/im">im</RouterLink>
    </nav>
    <main>
        <RouterView />
    </main>
</template>

<style scoped lang="scss">
nav, main {
    border: 2px solid #000;
    margin-bottom: 10px;
    padding: 10px;
}

nav > a + a {
    margin-left: 10px;
}
</style>
