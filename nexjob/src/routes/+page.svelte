<script lang="ts">
  import Header from '$lib/components/Header.svelte';
  import Hero from '$lib/components/Hero.svelte';
  import HowItWorks from '$lib/components/HowItWorks.svelte';
  import Premium from '$lib/components/Premium.svelte';
  import Footer from '$lib/components/Footer.svelte';
</script>

<div class="min-h-screen flex flex-col">
  <Header />
  
  <main class="flex-grow">
    <Hero />
    <HowItWorks />
    <Premium />
  </main>
  
  <Footer />
</div>