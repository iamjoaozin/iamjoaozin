<script lang="ts">
  import { Menu, X } from 'lucide-svelte';
  import { slide } from 'svelte/transition';

  let isMenuOpen = $state(false);

  function toggleMenu() {
    isMenuOpen = !isMenuOpen;
  }
</script>

<header class="bg-primary text-white font-sans sticky top-0 z-50 shadow-md">
  <div class="container mx-auto px-4 py-4 flex justify-between items-center">
    <!-- Logo -->
    <a href="/" class="text-2xl font-bold tracking-tight">NexJob</a>

    <!-- Desktop Navigation -->
    <nav class="hidden md:flex items-center space-x-6">
      <a href="/login/freelancer" class="hover:text-secondary transition-colors font-medium">Sou Freelancer</a>
      <a href="/login/client" class="hover:text-secondary transition-colors font-medium">Sou Cliente</a>
      <a href="/login" class="bg-white text-primary px-5 py-2 rounded-full font-bold hover:bg-secondary hover:text-white transition-all shadow-sm">
        Entrar
      </a>
    </nav>

    <!-- Mobile Menu Button -->
    <button class="md:hidden text-white focus:outline-none" onclick={toggleMenu} aria-label="Toggle menu">
      {#if isMenuOpen}
        <X size={28} />
      {:else}
        <Menu size={28} />
      {/if}
    </button>
  </div>

  <!-- Mobile Navigation -->
  {#if isMenuOpen}
    <div class="md:hidden bg-primary border-t border-blue-800" transition:slide>
      <nav class="flex flex-col p-4 space-y-4">
        <a href="/login/freelancer" class="block text-lg hover:text-secondary" onclick={toggleMenu}>Sou Freelancer</a>
        <a href="/login/client" class="block text-lg hover:text-secondary" onclick={toggleMenu}>Sou Cliente</a>
        <a href="/login" class="block w-full text-center bg-white text-primary px-5 py-3 rounded-full font-bold hover:bg-secondary hover:text-white transition-all" onclick={toggleMenu}>
          Entrar
        </a>
      </nav>
    </div>
  {/if}
</header>