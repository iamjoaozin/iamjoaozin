<script lang="ts">
  import { Briefcase, Users, Zap } from 'lucide-svelte';
</script>

<section class="py-20 bg-surface">
  <div class="container mx-auto px-4">
    <h2 class="text-3xl md:text-4xl font-bold text-center text-primary mb-16">Como funciona</h2>
    
    <div class="grid grid-cols-1 md:grid-cols-3 gap-8">
      <!-- Step 1 -->
      <div class="bg-white p-8 rounded-2xl shadow-lg hover:shadow-xl transition-shadow text-center group">
        <div class="w-16 h-16 bg-blue-100 text-primary rounded-full flex items-center justify-center mx-auto mb-6 group-hover:bg-primary group-hover:text-white transition-colors">
          <Briefcase size={32} />
        </div>
        <h3 class="text-xl font-bold mb-4 text-gray-800">Publique um job</h3>
        <p class="text-gray-600 leading-relaxed">
          Descreva o serviço e defina o orçamento. É grátis para postar.
        </p>
      </div>

      <!-- Step 2 -->
      <div class="bg-white p-8 rounded-2xl shadow-lg hover:shadow-xl transition-shadow text-center group">
        <div class="w-16 h-16 bg-blue-100 text-primary rounded-full flex items-center justify-center mx-auto mb-6 group-hover:bg-primary group-hover:text-white transition-colors">
          <Users size={32} />
        </div>
        <h3 class="text-xl font-bold mb-4 text-gray-800">Receba propostas</h3>
        <p class="text-gray-600 leading-relaxed">
          Freelas qualificados enviam orçamentos personalizados em minutos.
        </p>
      </div>

      <!-- Step 3 -->
      <div class="bg-white p-8 rounded-2xl shadow-lg hover:shadow-xl transition-shadow text-center group">
        <div class="w-16 h-16 bg-blue-100 text-primary rounded-full flex items-center justify-center mx-auto mb-6 group-hover:bg-primary group-hover:text-white transition-colors">
          <Zap size={32} />
        </div>
        <h3 class="text-xl font-bold mb-4 text-gray-800">Aprove e pague com Pix</h3>
        <p class="text-gray-600 leading-relaxed">
          Rápido, seguro e sem burocracia. O pagamento só é liberado quando você aprova.
        </p>
      </div>
    </div>
  </div>
</section>
