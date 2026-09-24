// Camada de anúncios — independente de hospedagem e de conteúdo.
// Trocar de rede = mudar este arquivo + os componentes em src/components/ads/.
// O ads.txt fica em public/ads.txt e precisa acompanhar o publisher abaixo.

export const ADS = {
  provider: 'adsense' as const,
  // Com true o script do AdSense entra no <head> (é também o que o AdSense usa
  // para verificar o site). Com false nenhum script de anúncio é carregado.
  enabled: true,
  client: 'ca-pub-5043795253193229',
  // IDs de bloco (data-ad-slot) criados no painel do AdSense.
  // Vazio = o bloco não é renderizado (Anúncios automáticos continuam funcionando).
  slots: {
    articleTop: '',
    articleBottom: '',
  },
};

export type AdPosition = keyof typeof ADS.slots;
