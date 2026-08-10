<script setup lang="ts">
import { RouterLink, RouterView } from 'vue-router'
</script>

<template>
  <div class="app-shell">
    <header class="site-header">
      <RouterLink to="/" class="brand">Basic Insurance</RouterLink>
      <nav>
        <RouterLink to="/">Home</RouterLink>
        <RouterLink to="/compare">Compare premiums</RouterLink>
      </nav>
    </header>

    <main>
      <RouterView />
    </main>

    <footer class="site-footer">
      <p>
        Real premium data from Switzerland's Federal Office of Public Health (BAG).
        &copy; {{ new Date().getFullYear() }} Basic Insurance.
      </p>
    </footer>
  </div>
</template>

<style scoped>
.app-shell {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
}

.site-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem 1.5rem;
  border-bottom: 1px solid var(--color-border);
}

.brand {
  font-weight: 700;
  font-size: 1.125rem;
  color: var(--color-heading);
  text-decoration: none;
}

.site-header nav {
  display: flex;
  gap: 1.25rem;
}

.site-header nav a {
  color: var(--color-text);
  text-decoration: none;
}

.site-header nav a.router-link-exact-active {
  color: var(--color-accent);
  font-weight: 600;
}

main {
  flex: 1;
  width: 100%;
  max-width: 960px;
  margin: 0 auto;
  padding: 2rem 1.5rem;
}

.site-footer {
  padding: 1rem 1.5rem;
  text-align: center;
  font-size: 0.8rem;
  color: var(--color-text-muted);
  border-top: 1px solid var(--color-border);
}
</style>
