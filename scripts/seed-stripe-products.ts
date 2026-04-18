import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function getStripeClient() {
  const { getUncachableStripeClient } = await import(path.join(__dirname, '../server/stripeClient.js'));
  return getUncachableStripeClient();
}

async function createProducts() {
  try {
    const stripe = await getStripeClient();

    console.log('Creating subscription tier products in Stripe...');

    const tiers = [
      { name: 'Subscription Tier 1', amount: 19900, meta: 'tier_1' },
      { name: 'Subscription Tier 2', amount: 42900, meta: 'tier_2' },
      { name: 'Subscription Tier 3', amount: 74900, meta: 'tier_3' },
    ];

    const priceIds: Record<string, string> = {};

    for (const tier of tiers) {
      const existing = await stripe.products.search({
        query: `name:'${tier.name}' AND active:'true'`,
      });

      let productId: string;

      if (existing.data.length > 0) {
        console.log(`${tier.name} already exists (${existing.data[0].id})`);
        productId = existing.data[0].id;

        const existingPrices = await stripe.prices.list({
          product: productId,
          active: true,
          recurring: { interval: 'month' } as any,
        });

        if (existingPrices.data.length > 0) {
          priceIds[tier.meta] = existingPrices.data[0].id;
          console.log(`  Price: ${existingPrices.data[0].id}`);
          continue;
        }
      } else {
        const product = await stripe.products.create({
          name: tier.name,
          description: `Merchant subscription - ${tier.name}`,
          metadata: { tier: tier.meta },
        });
        productId = product.id;
        console.log(`Created product: ${product.name} (${product.id})`);
      }

      const price = await stripe.prices.create({
        product: productId,
        unit_amount: tier.amount,
        currency: 'usd',
        recurring: { interval: 'month' },
        metadata: { tier: tier.meta },
      });
      priceIds[tier.meta] = price.id;
      console.log(`  Created price: $${(tier.amount / 100).toFixed(2)}/mo (${price.id})`);
    }

    console.log('\n=== Stripe Price IDs ===');
    console.log(JSON.stringify(priceIds, null, 2));
    console.log('\nAdd these to your environment as STRIPE_PRICE_TIER_1, STRIPE_PRICE_TIER_2, STRIPE_PRICE_TIER_3');

  } catch (error: any) {
    console.error('Error creating products:', error.message);
    process.exit(1);
  }
}

createProducts();
