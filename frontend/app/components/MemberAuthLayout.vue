<template>
  <section class="auth-page">
    <div class="auth-shell">
      <aside class="auth-story">
        <img src="/images/hero.jpg" alt="Un grimpeur sur une paroi rocheuse" width="960" height="1400">
        <NuxtLink to="/" class="auth-back">← Retour au site</NuxtLink>
        <div class="auth-story-copy">
          <span class="auth-kicker">Vertical Côtière · Beynost</span>
          <p>La grimpe.<br>Les rencontres.<br><em>Et vous.</em></p>
          <span class="auth-story-caption">Votre espace pour garder le lien avec le club.</span>
        </div>
      </aside>
      <div class="auth-content"><slot/></div>
    </div>
  </section>
</template>
