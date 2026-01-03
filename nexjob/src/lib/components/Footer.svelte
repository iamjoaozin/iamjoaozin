<script lang="ts">
  const currentYear = new Date().getFullYear();
</script>

<footer class="bg-surface text-gray-600 py-12 border-t border-gray-200">
  <div class="container mx-auto px-4 flex flex-col md:flex-row justify-between items-center gap-6">
    
    <div class="text-center md:text-left">
      <h4 class="text-xl font-bold text-primary mb-2">NexJob</h4>
      <p class="text-sm">
        &copy; {currentYear} — Desenvolvido por João Victor
      </p>
    </div>

    <div class="flex flex-wrap justify-center gap-8 text-sm font-medium">
      <a href="/terms" class="hover:text-primary transition-colors">Termos</a>
      <a href="/privacy" class="hover:text-primary transition-colors">Política</a>
      <a href="/contact" class="hover:text-primary transition-colors">Contato</a>
    </div>

  </div>
</footer>
