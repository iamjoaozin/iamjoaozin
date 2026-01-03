<script lang="ts">
  import { Rocket } from 'lucide-svelte';
</script>

<section class="py-20 bg-white">
  <div class="container mx-auto px-4">
    <div class="relative bg-gradient-to-r from-yellow-400 to-yellow-300 rounded-3xl p-8 md:p-16 shadow-2xl overflow-hidden text-center md:text-left flex flex-col md:flex-row items-center justify-between gap-10">
      
      <!-- Content -->
      <div class="z-10 max-w-2xl">
        <div class="inline-flex items-center gap-2 bg-yellow-100 text-yellow-800 px-4 py-1 rounded-full text-sm font-bold mb-6 uppercase tracking-wider">
          <Rocket size={16} />
          Para Freelancers
        </div>
        <h2 class="text-3xl md:text-5xl font-bold text-gray-900 mb-6">
          Ganhe mais sendo <br/> Freela Premium 🚀
        </h2>
        <p class="text-xl text-gray-800 mb-8 font-medium">
          Sem taxas. Conexões ilimitadas. Acesso completo ao NexJob por apenas <span class="font-bold text-black">R$50/mês</span>.
        </p>
        <button class="bg-black text-white px-8 py-4 rounded-full font-bold text-lg hover:bg-gray-800 transition-transform hover:scale-105 shadow-lg">
          Ativar Plano Premium
        </button>
      </div>

      <!-- Decorative Visual -->
      <div class="hidden md:block relative z-10">
        <div class="w-64 h-64 bg-white/30 backdrop-blur-sm rounded-full flex items-center justify-center border-4 border-white/50 shadow-inner">
           <span class="text-9xl">👑</span>
        </div>
      </div>

      <!-- Background Decorations -->
      <div class="absolute top-0 right-0 w-full h-full bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10"></div>
      <div class="absolute -bottom-24 -left-24 w-64 h-64 bg-yellow-200 rounded-full blur-3xl opacity-50"></div>
    </div>
  </div>
</section>
