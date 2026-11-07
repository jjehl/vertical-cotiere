// Les contrôles rendus par le serveur attendent leurs écouteurs Vue avant le premier clic.
export function useInteractive() {
  const interactive = ref(false);
  onMounted(() => {
    interactive.value = true;
  });
  return interactive;
}
