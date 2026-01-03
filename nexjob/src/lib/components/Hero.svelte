<script lang="ts">
  import { ArrowRight } from 'lucide-svelte';
</script>

<section class="relative bg-gradient-to-br from-primary to-secondary text-white overflow-hidden">
  <div class="container mx-auto px-4 py-20 md:py-32 flex flex-col md:flex-row items-center justify-between gap-12">
    <!-- Content -->
    <div class="flex-1 text-center md:text-left z-10">
      <h1 class="text-4xl md:text-6xl font-bold mb-6 leading-tight">
        Encontre o próximo job <br class="hidden md:block" /> em minutos.
      </h1>
      <p class="text-lg md:text-xl mb-8 opacity-90 max-w-lg mx-auto md:mx-0">
        Trabalhe fácil. Receba rápido. Conecte-se com quem precisa do seu talento.
      </p>
      
      <div class="flex flex-col sm:flex-row gap-4 justify-center md:justify-start">
        <a href="/login/client" class="bg-white text-primary px-8 py-4 rounded-full font-bold text-lg hover:bg-gray-100 transition-transform hover:scale-105 shadow-lg flex items-center justify-center gap-2">
          Quero contratar
        </a>
        <a href="/login/freelancer" class="bg-transparent border-2 border-white text-white px-8 py-4 rounded-full font-bold text-lg hover:bg-white hover:text-primary transition-all hover:scale-105 flex items-center justify-center gap-2">
          Quero trabalhar
          <ArrowRight size={20} />
        </a>
      </div>
    </div>

    <!-- Illustration / Image -->
    <div class="flex-1 relative z-10 flex justify-center md:justify-end">
        <!-- Abstract Illustration using SVG -->
        <svg width="100%" height="auto" viewBox="0 0 500 400" fill="none" xmlns="http://www.w3.org/2000/svg" class="max-w-md w-full drop-shadow-2xl">
            <rect x="50" y="50" width="300" height="200" rx="20" fill="rgba(255,255,255,0.1)" stroke="white" stroke-width="2"/>
            <circle cx="380" cy="100" r="50" fill="#FFD700" opacity="0.8"/>
            <rect x="80" y="100" width="150" height="20" rx="5" fill="white" opacity="0.6"/>
            <rect x="80" y="140" width="200" height="20" rx="5" fill="white" opacity="0.4"/>
            <rect x="80" y="180" width="100" height="20" rx="5" fill="white" opacity="0.4"/>
            <rect x="250" y="200" width="200" height="150" rx="20" fill="white" class="text-primary" fill-opacity="0.9"/>
            <path d="M300 250L350 300L400 240" stroke="#1E2A78" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/>
            <text x="320" y="330" font-family="Montserrat, sans-serif" font-weight="bold" font-size="24" fill="#1E2A78">Sucesso!</text>
        </svg>
    </div>
  </div>
  
  <!-- Decorative background elements -->
  <div class="absolute top-0 right-0 w-64 h-64 bg-white opacity-5 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl"></div>
  <div class="absolute bottom-0 left-0 w-96 h-96 bg-blue-900 opacity-20 rounded-full translate-y-1/2 -translate-x-1/4 blur-3xl"></div>
</section>
