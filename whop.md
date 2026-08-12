> ## Documentation Index
> Fetch the complete documentation index at: https://docs.whop.com/llms.txt
> Use this file to discover all available pages before exploring further.

# Accept payments

> Accept one-time and recurring payments across 195 countries with 100+ payment methods

export const ExamplesLink = ({href}) => <a href={href} className="examples-link">
		<div className="examples-link__row">
			<span className="examples-link__title">✨ Build this with AI</span>
			<span className="examples-link__jump">
				<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
					<path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6" />
					<polyline points="15 3 21 3 21 9" />
					<line x1="10" y1="14" x2="21" y2="3" />
				</svg>
			</span>
		</div>
		<p className="examples-link__description">
			Copy and paste our templates using your favorite editor
		</p>
		<div className="examples-link__icons">
			<span className="examples-link__icon" title="Claude">
				<svg viewBox="0 0 24 24">
					<path d="M4.709 15.955l4.72-2.647.08-.23-.08-.128H9.2l-.79-.048-2.698-.073-2.339-.097-2.266-.122-.571-.121L0 11.784l.055-.352.48-.321.686.06 1.52.103 2.278.158 1.652.097 2.449.255h.389l.055-.157-.134-.098-.103-.097-2.358-1.596-2.552-1.688-1.336-.972-.724-.491-.364-.462-.158-1.008.656-.722.881.06.225.061.893.686 1.908 1.476 2.491 1.833.365.304.145-.103.019-.073-.164-.274-1.355-2.446-1.446-2.49-.644-1.032-.17-.619a2.97 2.97 0 01-.104-.729L6.283.134 6.696 0l.996.134.42.364.62 1.414 1.002 2.229 1.555 3.03.456.898.243.832.091.255h.158V9.01l.128-1.706.237-2.095.23-2.695.08-.76.376-.91.747-.492.584.28.48.685-.067.444-.286 1.851-.559 2.903-.364 1.942h.212l.243-.242.985-1.306 1.652-2.064.73-.82.85-.904.547-.431h1.033l.76 1.129-.34 1.166-1.064 1.347-.881 1.142-1.264 1.7-.79 1.36.073.11.188-.02 2.856-.606 1.543-.28 1.841-.315.833.388.091.395-.328.807-1.969.486-2.309.462-3.439.813-.042.03.049.061 1.549.146.662.036h1.622l3.02.225.79.522.474.638-.079.485-1.215.62-1.64-.389-3.829-.91-1.312-.329h-.182v.11l1.093 1.068 2.006 1.81 2.509 2.33.127.578-.322.455-.34-.049-2.205-1.657-.851-.747-1.926-1.62h-.128v.17l.444.649 2.345 3.521.122 1.08-.17.353-.608.213-.668-.122-1.374-1.925-1.415-2.167-1.143-1.943-.14.08-.674 7.254-.316.37-.729.28-.607-.461-.322-.747.322-1.476.389-1.924.315-1.53.286-1.9.17-.632-.012-.042-.14.018-1.434 1.967-2.18 2.945-1.726 1.845-.414.164-.717-.37.067-.662.401-.589 2.388-3.036 1.44-1.882.93-1.086-.006-.158h-.055L4.132 18.56l-1.13.146-.487-.456.061-.746.231-.243 1.908-1.312-.006.006z" fill="#D97757" fillRule="nonzero" />
				</svg>
			</span>
			<span className="examples-link__icon" title="Cursor">
				<svg viewBox="85 69 343 354" fill="currentColor">
					<path d="M255.428 423l148.991-83.5L255.428 256l-148.99 83.5 148.99 83.5z" fillOpacity=".7" />
					<path d="M404.419 339.5v-167L255.428 89v167l148.991 83.5z" fillOpacity=".5" />
					<path d="M255.428 89l-148.99 83.5v167l148.99-83.5V89z" fillOpacity=".6" />
					<path d="M404.419 172.5L255.428 423V256l148.991-83.5z" fillOpacity=".9" />
					<path d="M404.419 172.5L255.428 256l-148.99-83.5h297.981z" />
				</svg>
			</span>
			<span className="examples-link__icon" title="Codex">
				<svg viewBox="0 0 24 24" fill="#10a37f">
					<path d="M9.205 8.658v-2.26c0-.19.072-.333.238-.428l4.543-2.616c.619-.357 1.356-.523 2.117-.523 2.854 0 4.662 2.212 4.662 4.566 0 .167 0 .357-.024.547l-4.71-2.759a.797.797 0 00-.856 0l-5.97 3.473zm10.609 8.8V12.06c0-.333-.143-.57-.429-.737l-5.97-3.473 1.95-1.118a.433.433 0 01.476 0l4.543 2.617c1.309.76 2.189 2.378 2.189 3.948 0 1.808-1.07 3.473-2.76 4.163zM7.802 12.703l-1.95-1.142c-.167-.095-.239-.238-.239-.428V5.899c0-2.545 1.95-4.472 4.591-4.472 1 0 1.927.333 2.712.928L8.23 5.067c-.285.166-.428.404-.428.737v6.898zM12 15.128l-2.795-1.57v-3.33L12 8.658l2.795 1.57v3.33L12 15.128zm1.796 7.23c-1 0-1.927-.332-2.712-.927l4.686-2.712c.285-.166.428-.404.428-.737v-6.898l1.974 1.142c.167.095.238.238.238.428v5.233c0 2.545-1.974 4.472-4.614 4.472zm-5.637-5.303l-4.544-2.617c-1.308-.761-2.188-2.378-2.188-3.948A4.482 4.482 0 014.21 6.327v5.423c0 .333.143.571.428.738l5.947 3.449-1.95 1.118a.432.432 0 01-.476 0zm-.262 3.9c-2.688 0-4.662-2.021-4.662-4.519 0-.19.024-.38.047-.57l4.686 2.71c.286.167.571.167.856 0l5.97-3.448v2.26c0 .19-.07.333-.237.428l-4.543 2.616c-.619.357-1.356.523-2.117.523zm5.899 2.83a5.947 5.947 0 005.827-4.756C22.287 18.339 24 15.84 24 13.296c0-1.665-.713-3.282-1.998-4.448.119-.5.19-.999.19-1.498 0-3.401-2.759-5.947-5.946-5.947-.642 0-1.26.095-1.88.31A5.962 5.962 0 0010.205 0a5.947 5.947 0 00-5.827 4.757C1.713 5.447 0 7.945 0 10.49c0 1.666.713 3.283 1.998 4.448-.119.5-.19 1-.19 1.499 0 3.401 2.759 5.946 5.946 5.946.642 0 1.26-.095 1.88-.309a5.96 5.96 0 004.162 1.713z" />
				</svg>
			</span>
			<span className="examples-link__icon" title="Lovable">
				<svg viewBox="0 0 24 24">
					<path clipRule="evenodd" d="M7.082 0c3.91 0 7.081 3.179 7.081 7.1v2.7h2.357c3.91 0 7.082 3.178 7.082 7.1 0 3.923-3.17 7.1-7.082 7.1H0V7.1C0 3.18 3.17 0 7.082 0z" fill="url(#lovable-grad)" fillRule="evenodd" />
					<defs>
						<radialGradient cx="0" cy="0" gradientTransform="matrix(-1 22.5 -30.454 -1.354 14 3)" gradientUnits="userSpaceOnUse" id="lovable-grad" r="1">
							<stop offset=".25" stopColor="#FE7B02" />
							<stop offset=".433" stopColor="#FE4230" />
							<stop offset=".548" stopColor="#FE529A" />
							<stop offset=".654" stopColor="#DD67EE" />
							<stop offset=".95" stopColor="#4B73FF" />
						</radialGradient>
					</defs>
				</svg>
			</span>
			<span className="examples-link__more">+ more</span>
		</div>
	</a>;

<ExamplesLink href="https://whop.com/network/examples?filter=checkouts" />

<iframe src="https://www.youtube.com/embed/AJeghHHvKfw?rel=0" title="Accept payments directly in your web app with Whop" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen style={{ aspectRatio: "16 / 9", width: "100%", border: 0 }} />

Accept one-time and recurring payments using checkout links or an embedded checkout component. Whop supports **100+ payment methods** across **195 countries**, and the right ones appear automatically based on the buyer's location. [See all payment methods](/payments-and-billing/local-payment-methods).

<Tip>
  Building an iOS app? The [Whop iOS Checkout SDK](/developer/guides/ios/overview) handles checkout natively with lower fees (2.7% + \$0.30 vs Apple's 15–30%). The SDK uses a scoped `iap:read` API key that's [safe to embed in your app](/developer/guides/ios/installation#step-3-create-an-api-key).
</Tip>

## Choose your integration

|                          | Checkout link              | Embedded checkout          |
| ------------------------ | -------------------------- | -------------------------- |
| **Effort**               | Low                        | Medium                     |
| **Customization**        | Limited                    | Full control               |
| **Best for**             | Sharing links, quick setup | Custom UX, dynamic pricing |
| **Server code required** | No (Dashboard) / Yes (API) | Yes                        |

## Option 1: Create a checkout link

Checkout links are the simplest way to accept payments. Create a plan to get a shareable checkout URL.

<Tabs>
  <Tab title="Dashboard">
    1. Go to your [Dashboard](https://whop.com/dashboard/links/checkout) > **Checkout links**
    2. Click **+ Create checkout link**
    3. Select a product and configure your pricing (free, one-time, or recurring)
    4. Click **Create checkout link**

    The generated link can be shared directly with customers or embedded on your website.
  </Tab>

  <Tab title="API">
    Create a plan via the API to get a `purchase_url`:

    <CodeGroup>
      ```typescript TypeScript theme={null}
      import Whop from "@whop/sdk";

      const client = new Whop({
        apiKey: "Company API Key",
      });

      // company_id: find in Dashboard > Settings
      // access_pass_id: find in Dashboard > Products
      const plan = await client.plans.create({
        company_id: "biz_xxxxxxxxxxxxx",
        access_pass_id: "pass_xxxxxxxxxxxxx",
        initial_price: 10.0,
        plan_type: "one_time",
      });

      console.log(plan.purchase_url);
      ```

      ```python Python theme={null}
      from whop_sdk import Whop

      client = Whop(
          api_key="Company API Key",
      )

      # company_id: find in Dashboard > Settings
      # access_pass_id: find in Dashboard > Products
      plan = client.plans.create(
          company_id="biz_xxxxxxxxxxxxx",
          access_pass_id="pass_xxxxxxxxxxxxx",
          initial_price=10.0,
          plan_type="one_time",
      )

      print(plan.purchase_url)
      ```
    </CodeGroup>

    Redirect customers to the `purchase_url` to complete payment on a Whop-hosted checkout page.
  </Tab>
</Tabs>

## Option 2: Embedded checkout

For a custom checkout experience, use the embedded checkout component with a checkout configuration.

### Step 1: Create a checkout configuration

Create a checkout configuration on your server with an inline plan:

<CodeGroup>
  ```typescript TypeScript theme={null}
  import Whop from "@whop/sdk";

  const client = new Whop({
    apiKey: "Company API Key",
  });

  const checkoutConfig = await client.checkoutConfigurations.create({
    company_id: "biz_xxxxxxxxxxxxx",
    plan: {
      initial_price: 10.0,
      plan_type: "one_time",
    },
    metadata: {
      order_id: "order_12345",
    },
  });

  console.log(checkoutConfig.id); // ch_xxxxxxxxxxxxx (session ID)
  console.log(checkoutConfig.plan?.id); // plan_xxxxxxxxxxxxx (plan ID)
  ```

  ```python Python theme={null}
  from whop_sdk import Whop

  client = Whop(
      api_key="Company API Key",
  )

  checkout_config = client.checkout_configurations.create(
      company_id="biz_xxxxxxxxxxxxx",
      plan={
          "initial_price": 10.0,
          "plan_type": "one_time",
      },
      metadata={
          "order_id": "order_12345",
      },
  )

  print(checkout_config.id)  # ch_xxxxxxxxxxxxx (session ID)
  print(checkout_config.plan.id)  # plan_xxxxxxxxxxxxx (plan ID)
  ```
</CodeGroup>

In this example:

* `company_id` is your company ID
* `plan.initial_price` is the payment amount
* `plan.plan_type` is either `one_time` or `renewal` for subscriptions
* `metadata` stores custom data for your reference

### Step 2: Render the checkout

<Tabs>
  <Tab title="React">
    ```tsx theme={null}
    import { WhopCheckoutEmbed } from "@whop/checkout/react";

    export function Checkout({ sessionId }: { sessionId: string }) {
      return (
        <WhopCheckoutEmbed
          sessionId={sessionId}
          returnUrl="https://yoursite.com/checkout/complete"
          onComplete={(paymentId) => {
            console.log("Payment complete:", paymentId);
          }}
        />
      );
    }
    ```

    Pass the `checkoutConfig.id` from step 1 as the `sessionId` prop.
  </Tab>

  <Tab title="HTML / JavaScript">
    Add the loader script to your page:

    ```html theme={null}
    <script async defer src="https://js.whop.com/static/checkout/loader.js"></script>
    ```

    Then add a checkout element with your plan ID and the `checkoutConfig.id` from step 1:

    ```html theme={null}
    <div
      data-whop-checkout-plan-id="plan_XXXXXXXXX"
      data-whop-checkout-session="ch_XXXXXXXXX"
      data-whop-checkout-return-url="https://yoursite.com/checkout/complete"
    ></div>
    ```
  </Tab>
</Tabs>

The `returnUrl` is required to handle redirects from external payment providers. When redirected, check the `status` query parameter:

* **success**: The payment succeeded. Use the receipt information to render a success page.
* **error**: The payment failed or was canceled. Remount the checkout so your customer can try again.

### Step 3: Customize the checkout

You can customize the checkout appearance and behavior:

| Prop (React)               | Attribute (HTML)                        | Description                                  |
| -------------------------- | --------------------------------------- | -------------------------------------------- |
| `theme`                    | `data-whop-checkout-theme`              | `"light"`, `"dark"`, or `"system"` (default) |
| `hidePrice`                | `data-whop-checkout-hide-price`         | Hide the price display                       |
| `themeOptions.accentColor` | `data-whop-checkout-theme-accent-color` | Custom accent color                          |

For the full list of customization options, see the [Embedded checkout reference](/payments/checkout-embed).

## Handle payment webhooks

Listen for webhooks to fulfill orders on your server. This example uses Next.js on Vercel, but the `whopsdk.webhooks.unwrap` pattern works with any framework:

```typescript theme={null}
import { waitUntil } from "@vercel/functions";
import type { Payment } from "@whop/sdk/resources.js";
import type { NextRequest } from "next/server";
import { whopsdk } from "@/lib/whop-sdk"; // your Whop SDK instance

export async function POST(request: NextRequest): Promise<Response> {
  const requestBodyText = await request.text();
  const headers = Object.fromEntries(request.headers);
  const webhookData = whopsdk.webhooks.unwrap(requestBodyText, { headers });

  if (webhookData.type === "payment.succeeded") {
    waitUntil(handlePaymentSucceeded(webhookData.data));
  }

  return new Response("OK", { status: 200 });
}

async function handlePaymentSucceeded(payment: Payment) {
  console.log("Payment succeeded:", payment.id);
}
```

Other useful webhook events: `membership.went_valid` (access granted), `payment.failed` (payment failed).

## See it work end-to-end

The fastest way to confirm everything's wired up is to run a test charge in sandbox and watch the result flow back to your server and dashboard.

### 1. Trigger a test charge

Switch your SDK and checkout to the sandbox environment, then run a checkout with a test card. The [sandbox guide](/developer/guides/sandbox) covers the URL changes and lists test cards for every payment outcome (succeeded, failed, requires action).

### 2. Inspect the webhook payload

When the test charge settles, your webhook handler receives a `payment.succeeded` event shaped like this:

```json theme={null}
{
  "id": "msg_xxxxxxxxxxxxx",
  "api_version": "v1",
  "type": "payment.succeeded",
  "timestamp": "2026-05-12T18:42:11.041Z",
  "company_id": "biz_xxxxxxxxxxxxx",
  "data": {
    "id": "pay_xxxxxxxxxxxxx",
    "status": "succeeded",
    "amount_after_fees": 9.71,
    "currency": "usd",
    "paid_at": "2026-05-12T18:42:10Z",
    "payment_method_type": "card",
    "card_brand": "visa",
    "card_last4": "4242",
    "member": { "id": "mem_xxxxxxxxxxxxx" },
    "metadata": {
      "order_id": "order_12345"
    }
  }
}
```

The `metadata.order_id` you attached when creating the checkout configuration flows straight through to the webhook handler. That's the hook you use to map the payment back to your own order record.

### 3. Verify in the sandbox dashboard

Open the sandbox dashboard at `https://sandbox.whop.com/dashboard/<your_company_id>/payments`. The test charge appears in this payments list with its status and amount; use your server logs to confirm the `metadata.order_id` you set maps back to the same order.

<img src="https://mintcdn.com/whop/jU1qiugUa1yCR1I4/images/sandbox-payments-dashboard.png?fit=max&auto=format&n=jU1qiugUa1yCR1I4&q=85&s=0dac30d4936ad5a412f1ceb5d54d056b" alt="Sandbox dashboard Payments page showing the payments list" width="1600" height="255" data-path="images/sandbox-payments-dashboard.png" />

If you see both the dashboard row and the `payment.succeeded` event on your server, the integration is live. Switch your SDK and webhook URL to production when ready.

## Next steps

<CardGroup cols={2}>
  <Card title="Webhooks" icon="webhook" href="/developer/guides/webhooks">
    Handle payment events in real-time
  </Card>

  <Card title="Save payment methods" icon="credit-card" href="/developer/guides/save-payment-methods">
    Save and charge payment methods
  </Card>

  <Card title="iOS payments" icon="apple" href="/developer/guides/ios/overview">
    Accept payments in your iOS app with lower fees
  </Card>

  <Card title="Payment methods" icon="globe" href="/payments-and-billing/local-payment-methods">
    100+ payment methods across 195 countries
  </Card>
</CardGroup>




> ## Documentation Index
> Fetch the complete documentation index at: https://docs.whop.com/llms.txt
> Use this file to discover all available pages before exploring further.

# Save payment methods

> Save customer payment methods to charge them later

Use saved payment methods to charge customers automatically for subscriptions, renewals, or usage-based billing. The customer saves their card once using a Whop hosted or embedded flow, and you can charge it any time after.

<Tip>
  Pair this guide with [webhooks](/developer/guides/webhooks): listen for `setup_intent.succeeded` to confirm the save, then for `payment.succeeded` / `payment.failed` to track future charges.
</Tip>

## Pick your save flow

Two paths, depending on whether the user is also paying right now.

|                           | Setup mode (collect-only)                                                                                                  | Save during checkout                                          |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| **Charges the user now?** | No                                                                                                                         | Yes                                                           |
| **Use case**              | Free trial signup, on-file card before usage-based billing                                                                 | Subscription that renews after the first paid checkout        |
| **API**                   | [Create checkout configuration](/api-reference/checkout-configurations/create-checkout-configuration) with `mode: "setup"` | Pass `setupFutureUsage: "off_session"` on `WhopCheckoutEmbed` |
| **Webhook to listen for** | `setup_intent.succeeded`                                                                                                   | `payment.succeeded` (the `payment_method` is on the result)   |

The rest of this page covers setup mode end-to-end, then shows how to charge a saved method later.

## Save a payment method

<Steps>
  <Step title="Create a checkout configuration in setup mode">
    [Create a checkout configuration](/api-reference/checkout-configurations/create-checkout-configuration) without a plan to collect payment details without charging. Add metadata to be able to link the member and payment method to a customer in your system.

    <CodeGroup>
      ```typescript TypeScript theme={null}
      const checkoutConfiguration = await whopsdk.checkoutConfigurations.create({
        company_id: "biz_XXXXXX",
        mode: "setup",
        redirect_url: "https://mywebsite.com/return_location",
        metadata: { customer_id: "my_internal_user_id" },
      });
      ```

      ```python Python theme={null}
      checkout_configuration = whopsdk.checkout_configurations.create(
          company_id="biz_XXXXXX",
          mode="setup",
          redirect_url="https://mywebsite.com/return_location",
          metadata={"customer_id": "my_internal_user_id"},
      )
      ```

      ```ruby Ruby theme={null}
      checkout_configuration = whopsdk.checkout_configurations.create(
        company_id: "biz_XXXXXX",
        mode: "setup",
        redirect_url: "https://mywebsite.com/return_location",
        metadata: { customer_id: "my_internal_user_id" },
      )
      ```
    </CodeGroup>
  </Step>

  <Step title="Direct the user to checkout">
    Use embedded checkout or redirect the user to save their payment method.

    <Tabs>
      <Tab title="Embedded">
        ```tsx theme={null}
        import { WhopCheckoutEmbed } from "@whop/checkout/react";

        export default function SavePayment() {
          return (
            <WhopCheckoutEmbed
              sessionId={checkoutConfiguration.id}
              returnUrl="https://yoursite.com/setup/complete"
              onComplete={(sessionId, setupIntentId, result) => {
                // payt_XXXXXXXXX — charge this any time
                saveForLater(result.payment_method_id);
              }}
            />
          );
        }
        ```

        The saved payment method is on the `onComplete` result, so a virtual
        terminal can charge it right away instead of waiting for a webhook. Whop
        only completes the checkout once the method is stored, so
        `payment_method_id` is always set here in setup mode.
      </Tab>

      <Tab title="Redirect">
        ```typescript theme={null}
        window.location.href = checkoutConfiguration.purchase_url;
        ```
      </Tab>
    </Tabs>
  </Step>

  <Step title="Handle completion">
    Listen for the `setup_intent.succeeded` webhook to get the payment method ID. The CheckoutConfiguration and its metadata will be included on the SetupIntent, which you can use to link the member and payment method to a customer in your system.

    <Note>
      Keep the webhook even if you read `payment_method_id` from `onComplete` — it is the only path that survives a closed tab, and the one that fires for the redirect flow.
    </Note>

    <Tip>
      The example uses `waitUntil` from `@vercel/functions` to run the handler after responding `200`. On other runtimes (Bun, Cloudflare Workers, Fastify, Hono) swap it for your framework's equivalent background-task primitive or a job queue. See the [webhooks guide](/developer/guides/webhooks) for Python and Ruby handler equivalents.
    </Tip>

    ```typescript theme={null}
    import { waitUntil } from "@vercel/functions";
    import type { NextRequest } from "next/server";
    import { whopsdk } from "@/lib/whop-sdk";

    export async function POST(request: NextRequest): Promise<Response> {
      const requestBodyText = await request.text();
      const headers = Object.fromEntries(request.headers);
      const webhookData = whopsdk.webhooks.unwrap(requestBodyText, { headers });

      if (webhookData.type === "setup_intent.succeeded") {
        waitUntil(handleSetupSucceeded(webhookData.data));
      }

      return new Response("OK", { status: 200 });
    }

    async function handleSetupSucceeded(setupIntent) {
      console.log("Payment method ID:", setupIntent.payment_method.id);
      console.log("Member ID:", setupIntent.member.id);
      console.log("Metadata:", setupIntent.metadata);
    }
    ```

    The payment method is now saved and authorized for this member.
  </Step>
</Steps>

## Charge a saved payment method

<Steps>
  <Step title="Get the payment method">
    [List saved payment methods](/api-reference/payment-methods/list-payment-methods) for a member or use the payment method ID from the setup intent in the previous step.

    <CodeGroup>
      ```typescript TypeScript theme={null}
      const payment_methods = await whopsdk.paymentMethods.list({
        member_id: "mber_XXXXXXXX",
      });

      const payment_method = payment_methods.data[0];
      ```

      ```python Python theme={null}
      payment_methods = whopsdk.payment_methods.list(member_id="mber_XXXXXXXX")
      payment_method = payment_methods.data[0]
      ```

      ```ruby Ruby theme={null}
      payment_methods = whopsdk.payment_methods.list(member_id: "mber_XXXXXXXX")
      payment_method = payment_methods.data.first
      ```
    </CodeGroup>
  </Step>

  <Step title="Create an off-session payment">
    Charge the payment method without customer interaction. The [create payment endpoint](/api-reference/payments/create-payment) returns a payment object immediately and processes the charge asynchronously.

    <CodeGroup>
      ```typescript TypeScript theme={null}
      const payment = await whopsdk.payments.create({
        plan: { initial_price: 40.00, currency: "usd", plan_type: "one_time" },
        company_id: "biz_XXXXXXXX",
        member_id: "mber_XXXXXXXX",
        payment_method_id: "payt_XXXXXXXXX",
      });

      console.log("Payment:", payment.id);
      ```

      ```python Python theme={null}
      payment = whopsdk.payments.create(
          plan={"initial_price": 40.00, "currency": "usd", "plan_type": "one_time"},
          company_id="biz_XXXXXXXX",
          member_id="mber_XXXXXXXX",
          payment_method_id="payt_XXXXXXXXX",
      )

      print("Payment:", payment.id)
      ```

      ```ruby Ruby theme={null}
      payment = whopsdk.payments.create(
        plan: { initial_price: 40.00, currency: "usd", plan_type: "one_time" },
        company_id: "biz_XXXXXXXX",
        member_id: "mber_XXXXXXXX",
        payment_method_id: "payt_XXXXXXXXX",
      )

      puts "Payment: #{payment.id}"
      ```
    </CodeGroup>

    <Tip>
      To apply a discount, pass the ID of one of your [promo codes](/manage-your-business/growth-marketing/promo-codes) as `promo_code_id` and Whop calculates the discounted price for you. The promo code must be active and valid for the plan, and the plan must belong to a product.
    </Tip>
  </Step>

  <Step title="Handle payment events">
    Listen for payment webhooks to track success or failure.

    ```typescript theme={null}
    if (webhookData.type === "payment.succeeded") {
      await fulfillOrder(webhookData.data);
    }

    if (webhookData.type === "payment.failed") {
      await notifyCustomer(webhookData.data.member.email, webhookData.data.failure_message);
    }
    ```
  </Step>
</Steps>

## Save during checkout

To save a payment method while processing a payment, add `setupFutureUsage: "off_session"` to the embedded checkout.

```tsx theme={null}
<WhopCheckoutEmbed
	planId="plan_XXXXXXXX"
	returnUrl="https://yoursite.com/checkout/complete"
	setupFutureUsage="off_session"
/>
```

The payment method will be saved after successful payment.

## Next steps

<CardGroup cols={2}>
  <Card title="Accept payments" href="/developer/guides/accept-payments">
    One-time and subscription checkouts to pair with your save flow.
  </Card>

  <Card title="Embedded checkout" href="/payments/checkout-embed">
    Drop checkout into your own site without redirects.
  </Card>

  <Card title="Listen to webhooks" href="/developer/guides/webhooks">
    Track `setup_intent.succeeded`, `payment.succeeded`, and `payment.failed`.
  </Card>

  <Card title="Billing portal" href="/payments-and-billing/manage-billing/billing-portal">
    Let customers manage and remove their saved payment methods.
  </Card>
</CardGroup>



> ## Documentation Index
> Fetch the complete documentation index at: https://docs.whop.com/llms.txt
> Use this file to discover all available pages before exploring further.

# Webhooks

> Receive payment, membership, and event notifications from Whop in realtime.

Webhooks are `POST` requests from Whop to your server. Use them to react to events like `payment.succeeded`, `membership.activated`, or `entry.created`.

<Tip>
  Webhooks follow the [Standard Webhooks](https://github.com/standard-webhooks/standard-webhooks) spec. Our SDKs handle unwrapping and signature verification for you.
</Tip>

## Set up a webhook

<Steps>
  <Step title="Create the webhook in the dashboard">
    Navigate to the [Developer tab in your dashboard](https://whop.com/dashboard/developer).

    Click **Create Webhook** in the top right corner.
  </Step>

  <Step title="Choose events and URL">
    Enter your webhook URL and select the events that you want to receive.
    Ensure that you are on API version `v1`.

    <Info>
      When testing locally, use ngrok or Cloudflare Tunnel to forward requests to your local development environment.
    </Info>
  </Step>

  <Step title="Store the webhook secret">
    Copy the webhook secret from the dashboard and store it as `WHOP_WEBHOOK_SECRET`.
  </Step>

  <Step title="Handle events on your server">
    Your endpoint now receives `POST` requests for every event you selected. See [Validating webhooks](#validating-webhooks) for example handlers.
  </Step>
</Steps>

## Validating webhooks

Always verify webhook signatures before you trust the payload. Otherwise someone could send your endpoint a fake event.

<Steps>
  <Step title="Set up your SDK client">
    Pass the secret into the SDK client on construction:

    <CodeGroup>
      ```typescript Typescript theme={null}
      import { Whop } from "@whop/sdk";

      export const whopsdk = new Whop({
         	apiKey: process.env.WHOP_API_KEY,
         	webhookKey: btoa(process.env.WHOP_WEBHOOK_SECRET || ""),
      });
      ```

      ```python Python theme={null}
      import base64
      import os
      from whop_sdk import Whop

      # webhook_key must be base64-encoded — the SDK passes it
      # straight to the Standard Webhooks verifier, which expects b64.
      whopsdk = Whop(
          api_key=os.environ["WHOP_API_KEY"],
          webhook_key=base64.b64encode(os.environ["WHOP_WEBHOOK_SECRET"].encode()).decode(),
      )
      ```

      ```ruby Ruby theme={null}
      require "base64"
      require "whop_sdk"

      # webhook_key must be base64-encoded — the SDK passes it
      # straight to the Standard Webhooks verifier, which expects b64.
      whopsdk = WhopSDK::Client.new(
        api_key: ENV["WHOP_API_KEY"],
        webhook_key: Base64.strict_encode64(ENV["WHOP_WEBHOOK_SECRET"]),
      )
      ```
    </CodeGroup>
  </Step>

  <Step title="Set up your API handler">
    Create a route that accepts HTTP `POST` requests. Use the same URL you entered during webhook creation.

    <Note>
      Our SDK unwraps and verifies the signature in one call. A bad signature raises; your handler won't see tampered events.
    </Note>

    <Tip>
      The TypeScript example uses `waitUntil` from `@vercel/functions` to run the handler after responding `200`. On other runtimes (Bun, Cloudflare Workers, Fastify, Hono) swap it for your framework's equivalent background-task primitive, or a job queue. The Python and Ruby examples show framework-native equivalents.
    </Tip>

    <CodeGroup>
      ```typescript Typescript + NextJS theme={null}
      import { waitUntil } from "@vercel/functions";
      import type { Payment } from "@whop/sdk/resources.js";
      import type { NextRequest } from "next/server";
      import { whopsdk } from "@/lib/whop-sdk";

      export async function POST(request: NextRequest): Promise<Response> {
         	// Validate the webhook to ensure it's from Whop
         	const requestBodyText = await request.text();
         	const headers = Object.fromEntries(request.headers);
         	const webhookData = whopsdk.webhooks.unwrap(requestBodyText, { headers });

         	// Handle the webhook event
         	if (webhookData.type === "payment.succeeded") {
        		waitUntil(handlePaymentSucceeded(webhookData.data));
         	}

         	// Make sure to return a 2xx status code quickly. Otherwise the webhook will be retried.
         	return new Response("OK", { status: 200 });
      }

      async function handlePaymentSucceeded(invoice: Payment) {
         	// This is a placeholder for a potentially long running operation
         	// In a real scenario, you might need to fetch user data, update a database, etc.
         	console.log("[PAYMENT SUCCEEDED]", invoice);
      }
      ```

      ```python Python + FastAPI theme={null}
      from fastapi import BackgroundTasks, FastAPI, Request, Response
      from lib.whop_sdk import whopsdk

      app = FastAPI()

      @app.post("/api/webhooks/whop")
      async def whop_webhook(request: Request, background: BackgroundTasks):
          # Unwrap + verify signature in one call. Raises on invalid signatures.
          body = (await request.body()).decode()
          event = whopsdk.webhooks.unwrap(body, headers=dict(request.headers))

          if event.type == "payment.succeeded":
              background.add_task(handle_payment_succeeded, event.data)

          # Respond 2xx quickly or Whop will retry.
          return Response(status_code=200)


      def handle_payment_succeeded(payment):
          # Replace with your fulfillment logic.
          print(f"[PAYMENT SUCCEEDED] {payment.id}")
      ```

      ```ruby Ruby on Rails theme={null}
      class Api::WebhooksController < ApplicationController
        skip_before_action :verify_authenticity_token

        def whop
          # Unwrap + verify signature in one call. Raises on invalid signatures.
          event = whopsdk.webhooks.unwrap(
            request.raw_post,
            headers: request.headers.to_h,
          )

          if event.type == "payment.succeeded"
            HandlePaymentSucceededJob.perform_later(event.data.id)
          end

          # Respond 2xx quickly or Whop will retry.
          head :ok
        end
      end
      ```

      ```bash cURL (verify manually) theme={null}
      # Standard Webhooks signatures live in these headers:
      #   webhook-id        — unique event id
      #   webhook-timestamp — unix seconds
      #   webhook-signature — v1,<base64-hmac-sha256>
      #
      # To verify manually: signed_content = "{id}.{timestamp}.{body}"
      # then HMAC-SHA256 with your base64-decoded secret and
      # compare base64-encoded output to the signature.
      curl -X POST https://your-domain.com/webhooks/whop \
        -H "webhook-id: msg_..." \
        -H "webhook-timestamp: 1735689600" \
        -H "webhook-signature: v1,..." \
        -H "content-type: application/json" \
        -d '{"type":"payment.succeeded","data":{...}}'
      ```
    </CodeGroup>
  </Step>
</Steps>

## Delivery guarantees

* **At-least-once delivery.** You may receive the same event more than once. Make your handler idempotent. Use the `webhook-id` header (or a unique field in the event body) as a dedup key.
* **Retries on non-2xx responses.** Whop makes the initial delivery attempt, then retries up to 3 times after 10 seconds, 20 seconds, and 40 seconds if your endpoint errors or does not return a 2xx in time. Failed deliveries stop after that short retry window.
* **Ordering is not guaranteed.** An event created later may arrive before an earlier one. Don't assume sequential delivery.
* **Respond fast.** Do the minimum work needed to acknowledge the event (verify + enqueue), then return 2xx. Long-running fulfillment belongs in a background task.

<Card title="Troubleshoot webhook delivery" icon="bug" href="/developer/troubleshooting#webhook-delivery">
  Fix signature failures, retries, duplicate events, and local tunnel issues.
</Card>

## Available webhooks

Every webhook Whop sends is documented in the [API Reference](/api-reference/). Within each resource, the `hook` pages specify the event name and the exact payload schema.

Common events:

* [`payment.succeeded`](/api-reference/payments/payment-succeeded): a payment is successfully processed.
* [`ledger_account.funds_available`](/api-reference/ledger-accounts/ledger-account): pending funds clear and your withdrawable balance increases.
* [`membership.activated`](/api-reference/memberships/membership-activated): someone joins your community on a product.
* [`membership.deactivated`](/api-reference/memberships/membership-deactivated): a membership goes invalid (failed payment, cancellation, or leaving).
* [`membership.trial_ending_soon`](/api-reference/memberships/membership-activated): a free trial ends within \~72 hours.
* [`entry.created`](/api-reference/entries/entry-created): someone joins a waitlist.
* [`refund.created`](/api-reference/refunds/refund-created): a payment is refunded.
* [`dispute.created`](/api-reference/disputes/dispute-created): a buyer opens a chargeback.

## Next steps

<CardGroup cols={2}>
  <Card title="Accept payments" href="/developer/guides/accept-payments">
    Pair `payment.succeeded` webhooks with checkout to fulfill orders.
  </Card>

  <Card title="Save payment methods" href="/developer/guides/save-payment-methods">
    Use setup intents + webhooks to charge customers later.
  </Card>

  <Card title="API walkthrough" href="/developer/api/getting-started">
    See where webhooks fit alongside checkout, transfers, and KYC.
  </Card>

  <Card title="Run a local dev proxy" href="/developer/guides/dev-proxy">
    Forward Whop webhooks to localhost while developing.
  </Card>
</CardGroup>


> ## Documentation Index
> Fetch the complete documentation index at: https://docs.whop.com/llms.txt
> Use this file to discover all available pages before exploring further.

# Enable Apple Pay

> Enable Apple Pay for your embedded checkout by verifying your domain

Apple Pay allows customers to pay using their Apple Wallet, providing a seamless checkout experience on Safari and iOS devices. To enable Apple Pay on your embedded checkout, you need to verify ownership of your domain.

<Note>
  Domain verification is only required for [embedded
  checkout](/payments/checkout-embed). Whop-hosted checkout pages already
  support Apple Pay without any additional setup.
</Note>

## Prerequisites

Before setting up Apple Pay, ensure you have:

* A domain where you're hosting the embedded checkout
* Access to your domain's DNS settings (for Whop-hosted verification) or file hosting (for self-hosted verification)
* `@whop/checkout@0.0.43` or later if using the `hideSubmitButton` option in React

## Choose a verification method

There are two ways to verify your domain for Apple Pay:

<CardGroup cols={2}>
  <Card title="Whop-hosted verification" icon="wand-magic-sparkles" href="#whop-hosted-verification">
    Recommended for most users. Whop handles the verification file hosting - you
    just need to add DNS records.
  </Card>

  <Card title="Self-hosted verification" icon="server" href="#self-hosted-verification">
    For advanced users who prefer to host the verification file themselves.
  </Card>
</CardGroup>

## Whop-hosted verification

This method lets Whop host the Apple Pay verification file on your behalf. You'll temporarily point your domain to Whop's servers to complete verification, then revert your DNS settings.

<Warning>
  This method requires temporary DNS changes that will cause your domain to be
  unavailable for a few minutes during verification. Plan accordingly.
</Warning>

<Note>
  **Before you begin:** Take a screenshot or export your current DNS records for
  the domain you're verifying. While the verification wizard will show revert
  instructions after completion, these are best-effort and may not capture all
  edge cases. Having your own backup ensures you can restore your DNS
  configuration accurately.
</Note>

### Step 0: Lower your DNS TTL (optional)

If the domain you're verifying is actively serving traffic, consider lowering the TTL (Time To Live) on the existing DNS record for that domain before starting. This ensures DNS changes propagate faster when you switch records and when you revert them. If you skip this step, downtime may last longer while DNS caches expire.

<Accordion title="How to lower your TTL">
  1. Find the existing A or CNAME record for the domain you want to verify
     (e.g., the record for `checkout.yoursite.com`) 2. Lower its TTL to 60-300
     seconds 3. Wait for the previous TTL duration to pass (e.g., if it was 1 hour,
     wait 1 hour) so all DNS caches refresh 4. Then proceed with the verification
     steps below
</Accordion>

### Step 1: Open payment domains settings

Navigate to your [checkout settings](https://whop.com/dashboard/settings/checkout/) and find the **Apple Pay for embedded checkout** section. Click **Configure** to open the domain management panel.

<Frame>
  <img src="https://mintcdn.com/whop/qJMsh85qcrvhDnDi/images/apple-pay/payment-domains-settings.png?fit=max&auto=format&n=qJMsh85qcrvhDnDi&q=85&s=2797c1311a2bbd28cdef5e86929eb25f" alt="Payment domains settings showing the Configure button" width="2868" height="1654" data-path="images/apple-pay/payment-domains-settings.png" />
</Frame>

### Step 2: Add your domain

Click the **+** button (or **Add payment domain** if no domains exist yet). From the dropdown menu, select **Whop-hosted verification**.

<Frame>
  <img src="https://mintcdn.com/whop/qJMsh85qcrvhDnDi/images/apple-pay/dropdown-whop-hosted-verification.png?fit=max&auto=format&n=qJMsh85qcrvhDnDi&q=85&s=f1650433be75f04aa48fac1f336380ad" alt="Add domain dropdown menu with Whop-hosted option" width="1262" height="902" data-path="images/apple-pay/dropdown-whop-hosted-verification.png" />
</Frame>

Enter the domain where you're hosting the embedded checkout (e.g., `checkout.yoursite.com` or `yoursite.com`). You'll need to acknowledge that your domain will experience temporary downtime during the verification process by checking the confirmation checkbox, then click **Start verification**.

<Frame>
  <img src="https://mintcdn.com/whop/qJMsh85qcrvhDnDi/images/apple-pay/add-domain-dialog.png?fit=max&auto=format&n=qJMsh85qcrvhDnDi&q=85&s=2cb42e439775b661dcbc84a5ea0092f7" alt="Add domain dialog for Whop-hosted verification" width="2278" height="1326" data-path="images/apple-pay/add-domain-dialog.png" />
</Frame>

### Step 3: Add DNS records

<Warning>
  This step will cause downtime for your domain. Your domain will point to
  Whop's servers until you revert the DNS records after verification. **If you
  haven't already, take a screenshot of your current DNS settings now** before
  making any changes.
</Warning>

After adding your domain, you'll see a list of DNS records that need to be added to your domain's DNS settings. These typically include:

* **A record** or **CNAME record** - Points your domain to Whop's verification servers
* (optional) **TXT record** - Proves domain ownership

<Tip>
  Use a low TTL (60-300 seconds) so you can revert quickly after verification.
</Tip>

<Frame>
  <img src="https://mintcdn.com/whop/qJMsh85qcrvhDnDi/images/apple-pay/dns-records.png?fit=max&auto=format&n=qJMsh85qcrvhDnDi&q=85&s=afb3e74290f7cc89b5ff2a5d8e6b74f0" alt="DNS records to add for domain verification" width="1202" height="788" data-path="images/apple-pay/dns-records.png" />
</Frame>

If your domain already has an A or CNAME record, **edit or replace it** with the values shown—don't add a second record alongside the existing one. You can find these settings in your DNS provider's dashboard (e.g., Cloudflare, Namecheap, GoDaddy, Route 53).

<Frame caption="Example DNS configuration in Cloudflare">
  <img src="https://mintcdn.com/whop/qJMsh85qcrvhDnDi/images/apple-pay/dns-records-cf.png?fit=max&auto=format&n=qJMsh85qcrvhDnDi&q=85&s=c1ff43b3cf54e6a04edcdf395460d8af" alt="DNS records configured in Cloudflare" width="2204" height="232" data-path="images/apple-pay/dns-records-cf.png" />
</Frame>

### Step 4: Wait for DNS propagation

DNS changes can take anywhere from a few minutes to 48 hours to propagate, though most changes are visible within 5-15 minutes. The verification wizard will automatically detect when your DNS records are properly configured.

### Step 5: Complete verification

Once the DNS records are verified, Whop will:

1. Issue an SSL certificate for your domain
2. Host the Apple Pay verification file
3. Register your domain with Apple

### Step 6: Revert DNS settings

After verification is complete, revert your DNS settings to point back to your original hosting. The Apple Pay verification will remain valid. The wizard will show you the records to delete and restore.

<Warning>
  The revert instructions shown in the wizard are **best-effort** and may not be
  100% accurate in all cases. Always refer to your own DNS backup (screenshot or
  export) to ensure you restore the correct values. If you're unsure, check with
  your hosting provider for the correct DNS configuration.
</Warning>

<Frame>
  <img src="https://mintcdn.com/whop/qJMsh85qcrvhDnDi/images/apple-pay/verification-complete.png?fit=max&auto=format&n=qJMsh85qcrvhDnDi&q=85&s=0808edbf3d3498a9b445d5c10cf719e2" alt="Domain verification complete with revert instructions" width="1194" height="1328" data-path="images/apple-pay/verification-complete.png" />
</Frame>

## Self-hosted verification

If you prefer to host the verification file yourself, you can do so by serving the Apple Pay merchant ID domain association file at a specific path on your domain.

### Step 1: Download the verification file

Download the [Apple Pay verification file](https://whop.com/.well-known/apple-platform-integrator/apple-developer-merchantid-domain-association).

### Step 2: Host the file

Host this file at the following path on your domain:

```
https://<your-domain>/.well-known/apple-developer-merchantid-domain-association
```

The file must be:

* Served over HTTPS
* Accessible without authentication
* Served with the correct content (no modifications)

<Tabs>
  <Tab title="Next.js">
    Place the file in your `public` folder:

    ```
    public/
    └── .well-known/
        └── apple-developer-merchantid-domain-association
    ```
  </Tab>

  <Tab title="Nginx">
    Add a location block to serve the file:

    ```nginx theme={null}
    location /.well-known/apple-developer-merchantid-domain-association {
        alias /path/to/apple-developer-merchantid-domain-association;
        default_type application/octet-stream;
    }
    ```
  </Tab>

  <Tab title="Vercel">
    Create a `vercel.json` with a rewrite rule that proxies to the Whop-hosted file:

    ```json theme={null}
    {
      "rewrites": [
        {
          "source": "/.well-known/apple-developer-merchantid-domain-association",
          "destination": "https://whop.com/.well-known/apple-platform-integrator/apple-developer-merchantid-domain-association"
        }
      ]
    }
    ```
  </Tab>

  <Tab title="Cloudflare Pages">
    Place the file in your output directory:

    ```
    dist/
    └── .well-known/
        └── apple-developer-merchantid-domain-association
    ```
  </Tab>
</Tabs>

### Step 3: Verify the file is accessible

Test that the file is accessible by visiting:

```
https://<your-domain>/.well-known/apple-developer-merchantid-domain-association
```

The file should download or display its contents without any errors.

### Step 4: Open payment domains settings

Navigate to your [checkout settings](https://whop.com/dashboard/settings/checkout/) and find the **Apple Pay for embedded checkout** section. Click **Configure** to open the domain management panel.

<Frame>
  <img src="https://mintcdn.com/whop/qJMsh85qcrvhDnDi/images/apple-pay/payment-domains-settings.png?fit=max&auto=format&n=qJMsh85qcrvhDnDi&q=85&s=2797c1311a2bbd28cdef5e86929eb25f" alt="Payment domains settings showing the Configure button" width="2868" height="1654" data-path="images/apple-pay/payment-domains-settings.png" />
</Frame>

### Step 5: Register your domain

Click the **+** button (or **Add payment domain** if no domains exist yet). From the dropdown menu, select **Self-hosted verification**.

<Frame>
  <img src="https://mintcdn.com/whop/qJMsh85qcrvhDnDi/images/apple-pay/dropdown-self-hosted-verification.png?fit=max&auto=format&n=qJMsh85qcrvhDnDi&q=85&s=e9f392d465afa3a683828dc386f7a3bc" alt="Add domain dropdown menu with self-hosted option" width="1262" height="902" data-path="images/apple-pay/dropdown-self-hosted-verification.png" />
</Frame>

Enter your domain. Whop will verify that the file is accessible before registering your domain with Apple.

<Frame>
  <img src="https://mintcdn.com/whop/qJMsh85qcrvhDnDi/images/apple-pay/add-domain-self-hosted.png?fit=max&auto=format&n=qJMsh85qcrvhDnDi&q=85&s=cbb7f1aa2b9d605470356ee4d058f7cd" alt="Add domain dialog for self-hosted verification" width="2608" height="1246" data-path="images/apple-pay/add-domain-self-hosted.png" />
</Frame>

## Troubleshooting

<AccordionGroup>
  <Accordion title="Apple Pay button doesn't appear">
    * Ensure your domain is fully verified in the payment domains settings -
      Check that you're using `@whop/checkout@0.0.43` or later - Apple Pay only
      appears on supported browsers (Safari) and devices (iOS, macOS) - Test on an
      actual Apple device, not in a simulator - If using **Framer**, make sure you
      are loading the checkout SDK via Custom Code in your site headers, not via
      the Embed component. Framer's Embed component uses a `srcdoc` iframe which
      Safari treats as an insecure context, blocking Apple Pay. See the [Framer
      checkout
      guide](/third-party-integrations/embedded-checkouts/framer-checkout) for the
      correct setup.
  </Accordion>

  <Accordion title="DNS verification is taking too long">
    * DNS propagation can take up to 48 hours in some cases - Use a tool like
      [dnschecker.org](https://dnschecker.org) to verify your records have
      propagated - Ensure you've added the records to the correct DNS zone - If
      using Cloudflare, make sure the DNS record is set to "DNS only" (gray
      cloud), not "Proxied" (orange cloud) during verification
  </Accordion>

  <Accordion title="SSL certificate verification failed">
    * Ensure your DNS records are pointing to the correct values - Wait a few
      minutes for the certificate to be issued - If the issue persists, try
      removing and re-adding the domain
  </Accordion>

  <Accordion title="Self-hosted file returns 404">
    * Verify the file is in the correct location:
      `/.well-known/apple-developer-merchantid-domain-association` - Check that
      your web server is configured to serve files without extensions - Ensure the
      `.well-known` directory is not blocked by your hosting configuration
  </Accordion>
</AccordionGroup>

## Next steps

<CardGroup cols={2}>
  <Card title="Embedded Checkout" icon="code" href="/payments/checkout-embed">
    Learn how to embed Whop checkout on your website
  </Card>

  <Card title="Checkout Links" icon="link" href="/payments/create-checkout-link">
    Create shareable checkout links for your products
  </Card>
</CardGroup>

> ## Documentation Index
> Fetch the complete documentation index at: https://docs.whop.com/llms.txt
> Use this file to discover all available pages before exploring further.

# Embed checkout

> Learn how to embed Whop's checkout flow on your website

Embedded checkout allows you to embed Whop's checkout flow on your own website. This allows you to offer your customers a seamless checkout experience without leaving your website.

<Card title="Try the checkout playground" icon="sliders" href="https://whop.com/checkout-playground">
  Customize colors, radius, and fields in real time, then copy the generated embed code.
</Card>

<iframe width="100%" height="400" src="https://www.youtube.com/embed/0hGnAzwxd4g?si=0LDncN3P_MKfrsvD&rel=0" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen />

## React setup

### Step 1: Install the package

```bash theme={null}
npm install @whop/checkout
```

### Step 2: Add the checkout element

```tsx theme={null}
import { WhopCheckoutEmbed } from "@whop/checkout/react";

export default function Home() {
	return (
		<WhopCheckoutEmbed
			planId="plan_XXXXXXXXX"
			returnUrl="https://yoursite.com/checkout/complete"
		/>
	);
}
```

This component will mount an iframe with the Whop checkout embed.

The `returnUrl` is required to handle redirects from external payment providers. When redirected, check the `status` query parameter:

* **success**: The payment succeeded. Use the receipt information to render a success page.
* **error**: The payment failed or was canceled. Remount the checkout so your customer can try again.

<Tip>
  Keep that Plan ID handy. You'll need to paste it into your website code, so
  save it somewhere you can find it.
</Tip>

### Step 3: **(optional)** Configure - Programmatic controls

To get access to the controls of the checkout embed, you can use the `ref` prop.

```tsx theme={null}
const ref = useCheckoutEmbedControls();

return <WhopCheckoutEmbed ref={ref} planId="plan_XXXXXXXXX" />;
```

#### **`submit`**

To submit checkout programmatically, you can use the `submit` method on the checkout element.

```tsx theme={null}
ref.current?.submit();
```

#### **`getEmail`**

To get the email of the user who is checking out, you can use the `getEmail` method on the checkout element.

```tsx theme={null}
const email = await ref.current?.getEmail();
console.log(email);
```

#### **`setEmail`**

To set the email of the user who is checking out, you can use the `setEmail` method on the checkout element.

```tsx theme={null}
try {
	await ref.current?.setEmail("example@domain.com");
} catch (error) {
	console.error(error);
}
```

#### **`getAddress`**

To get the address of the user who is checking out, you can use the `getAddress` method on the checkout element.

```tsx theme={null}
const address = await ref.current?.getAddress();
console.log(address);
```

#### **`setAddress`**

To set the address of the user who is checking out, you can use the `setAddress` method on the checkout element.

<Note>
  This method will only work if the address form is hidden. You can hide the
  address form by setting the `hideAddressForm` prop to `true`.
</Note>

```tsx theme={null}
try {
	await ref.current?.setAddress({
		name: "John Doe",
		country: "US",
		line1: "123 Main St",
		city: "Any Town",
		state: "CA",
		postalCode: "12345",
	});
} catch (error) {
	console.error(error);
}
```

### Step 4: **(optional)** Configure - Available properties

#### **`planId`**

**Required** - The plan id you want to checkout.

#### **`theme`**

**Optional** - The theme you want to use for the checkout.

Possible values are `light`, `dark` or `system`.

#### **`themeOptions`**

**Optional** - Fine-grained theme options for the checkout embed.

**`themeOptions.backgroundColor`** - A hex color to match the embed background to your site. The embed automatically picks light or dark text and tints its panels and inputs to fit the color, overriding `theme`.

```tsx theme={null}
<WhopCheckoutEmbed
	themeOptions={{ backgroundColor: "#09090b" }}
	planId="plan_XXXXXXXXX"
/>
```

**`themeOptions.accentColor`** - The accent color used for the submit button, focus rings, and links. Accepts any hex color — the embed derives the full accent palette from it, including a legible button text color. Named palette values like `green` or `blue` are also supported (the full list is under `data-whop-checkout-theme-accent-color`).

```tsx theme={null}
<WhopCheckoutEmbed
	themeOptions={{ accentColor: "#7c3aed" }}
	planId="plan_XXXXXXXXX"
/>
```

**`themeOptions.highContrast`** - Set to `true` to render the submit button with higher contrast against the checkout background.

```tsx theme={null}
<WhopCheckoutEmbed
	themeOptions={{ highContrast: true }}
	planId="plan_XXXXXXXXX"
/>
```

**`themeOptions.borderRadius`** - The corner radius for the embed, in pixels. Inputs and containers use the value as-is; buttons scale proportionally (1.5×). Pass `0` for square corners.

```tsx theme={null}
<WhopCheckoutEmbed
	themeOptions={{ borderRadius: 8 }}
	planId="plan_XXXXXXXXX"
/>
```

#### **`sessionId`**

**Optional** - The session id to use for the checkout.

This can be used to attach metadata to a checkout by first creating a session through the API and then passing the session id to the checkout element.

#### **`returnUrl`**

**Optional** - The URL to redirect the user to after checkout completes.

```tsx theme={null}
<WhopCheckoutEmbed
	returnUrl="https://yoursite.com/checkout/complete"
	planId="plan_XXXXXXXXX"
/>
```

#### **`affiliateCode`**

**Optional** - The affiliate code to use for the checkout.

```tsx theme={null}
<WhopCheckoutEmbed affiliateCode="tristan" planId="plan_XXXXXXXXX" />
```

#### **`hidePrice`**

**Optional** - Turn on to hide the price in the embedded checkout form.

Defaults to `false`

#### **`hideTermsAndConditions`**

**Optional** - Set to `true` to hide the terms and conditions in the embedded checkout form.

Defaults to `false`

#### **`skipRedirect`**

**Optional** - Set to `true` to skip the final redirect and keep the top frame loaded.

Defaults to `false`

#### **`adaptivePricing`**

**Optional** - Set to `true` to enable adaptive pricing on the embedded checkout. When enabled and supported for the plan, prices are presented in the buyer's local currency.

Defaults to `false` — embedded checkouts must opt in explicitly. Buyers will be charged in the plan's base currency unless this is set.

See [Listening for currency changes](#listening-for-currency-changes) to react to currency events from the embed or switch currencies programmatically.

```tsx theme={null}
<WhopCheckoutEmbed adaptivePricing planId="plan_XXXXXXXXX" />
```

#### **`collectPhoneNumbers`**

**Optional** - Set to `true` to require a phone number, `"optional"` to show a phone number field that buyers may leave blank, or `false` to disable collection. When omitted, the plan's feature setting is used.

```tsx theme={null}
<WhopCheckoutEmbed collectPhoneNumbers="optional" planId="plan_XXXXXXXXX" />
```

#### **`collectShipping`**

**Optional** - Set to `true` to collect a shipping address during checkout, even when the plan does not require one. Works in both the regular embedded checkout and the [one click checkout button](/payments/one-click-checkout-button) (Apple Pay; Google Pay shipping support is pending). To hide the shipping address instead, use `shipping.address.hidden`.

```tsx theme={null}
<WhopCheckoutEmbed collectShipping planId="plan_XXXXXXXXX" />
```

#### **`locale`**

**Optional** - The language the checkout renders in, as a locale code (e.g. `"es"`, `"fr"`, `"pt"`). When omitted, the checkout falls back to the buyer's browser language preference.

```tsx theme={null}
<WhopCheckoutEmbed locale="es" planId="plan_XXXXXXXXX" />
```

#### **`onComplete`**

**Optional** - A callback function that will be called when the checkout is complete.

<Note>This option will set `skipRedirect` to `true`</Note>

```tsx theme={null}
<WhopCheckoutEmbed
	onComplete={(planId, receiptId) => {
		console.log(planId, receiptId);
	}}
	planId="plan_XXXXXXXXX"
/>
```

The third argument carries everything the completed checkout resolved to. In
[setup mode](/developer/guides/save-payment-methods) it includes
`payment_method_id` — the saved payment method, ready to charge later without
waiting for the `setup_intent.succeeded` webhook.

```tsx theme={null}
<WhopCheckoutEmbed
	onComplete={(sessionId, setupIntentId, result) => {
		console.log(result.payment_method_id); // payt_XXXXXXXXX
	}}
	sessionId="ch_XXXXXXXXX"
/>
```

#### **`utm`**

**Optional** - The UTM parameters to add to the checkout URL.

**Note** - The keys must start with `utm_`

```tsx theme={null}
<WhopCheckoutEmbed
	planId="plan_XXXXXXXXX"
	utm={{ utm_campaign: "ad_XXXXXXX" }}
/>
```

#### **`fallback`**

**Optional** - The fallback content to show while the checkout is loading.

```tsx theme={null}
<WhopCheckoutEmbed fallback={<>loading...</>} planId="plan_XXXXXXXXX" />
```

#### **`prefill`**

**Optional** - The prefill options to apply to the checkout embed.

Used to prefill the email or address in the embedded checkout form.
This setting can be helpful when integrating the embed into a funnel that collects the email prior to payment already.

```tsx theme={null}
<WhopCheckoutEmbed
  prefill={{ email: "example@domain.com" }}
  planId="plan_XXXXXXXXX"
/>
<WhopCheckoutEmbed
  prefill={{ address: {
    name: "John Doe",
    country: "US",
    line1: "123 Main St",
    city: "Any Town",
    state: "CA",
    postalCode: "12345",
  } }}
  planId="plan_XXXXXXXXX"
/>
```

#### **`hideEmail`**

**Optional** - Set to `true` to hide the email input in the embedded checkout form. Make sure to display the users email in the parent page when setting this attribute.

Defaults to `false`

<Note>
  Use this in conjunction with the `prefill` attribute or the `setEmail` method
  to control the email input.
</Note>

```tsx theme={null}
<WhopCheckoutEmbed hideEmail planId="plan_XXXXXXXXX" />
```

#### **`disableEmail`**

**Optional** - Set to `true` to disable the email input in the embedded checkout form.

Defaults to `false`

<Note>
  Use this in conjunction with the `prefill` attribute or the `setEmail` method
  to control the email input.
</Note>

```tsx theme={null}
<WhopCheckoutEmbed disableEmail planId="plan_XXXXXXXXX" />
```

#### **`hideAddressForm`**

**Optional** - Set to `true` to hide the address form in the embedded checkout form.

Defaults to `false`

<Note>
  Use this in conjunction with the `setAddress` method to control the address
  input.
</Note>

```tsx theme={null}
<WhopCheckoutEmbed hideAddressForm planId="plan_XXXXXXXXX" />
```

#### **`setupFutureUsage`**

**Optional** - The setup future usage to use for the checkout. When using the `chargeUser` API you need to set this to `off_session`. This will filter out payment methods that are not supported with that API.

```tsx theme={null}
<WhopCheckoutEmbed setupFutureUsage="off_session" planId="plan_XXXXXXXXX" />
```

#### **`onStateChange`**

**Optional** - A callback function that will be called when the checkout state changes.

This can be used when programmatically submitting the checkout embed.

Possible values are `loading`, `ready`, `disabled`.

```tsx theme={null}
<WhopCheckoutEmbed
	onStateChange={(state) => {
		console.log(state);
	}}
	planId="plan_XXXXXXXXX"
/>
```

#### **`environment`**

**Optional** - The environment to use for the checkout.

Possible values are `production` or `sandbox`.

Defaults to `production`

<Note>
  When using `sandbox`, make sure to use a sandbox plan ID. Sandbox plans can be
  created in the [sandbox dashboard](https://sandbox.whop.com/dashboard).
</Note>

```tsx theme={null}
<WhopCheckoutEmbed environment="sandbox" planId="plan_XXXXXXXXX" />
```

#### **`onAddressValidationError`**

**Optional** - A callback function that will be called when the address validation error occurs.

<Note>
  This method will only work if the address form is hidden. You can hide the
  address form by setting the `hideAddressForm` prop to `true`.
</Note>

```tsx theme={null}
<WhopCheckoutEmbed
	hideAddressForm
	onAddressValidationError={(error) => {
		console.log(error);
	}}
	planId="plan_XXXXXXXXX"
/>
```

#### **`onPaymentError`**

**Optional** - A callback function that will be called when checkout payment processing fails.

The callback receives an error object with a human readable `message` and an optional machine readable `code`. It fires for declines on submit as well as failures detected while the payment is processing, for example after 3D Secure or a redirect to an external payment provider.

```tsx theme={null}
<WhopCheckoutEmbed
	onPaymentError={(error) => {
		console.log(error.message, error.code);
	}}
	planId="plan_XXXXXXXXX"
/>
```

#### **`onPromoCodeChanged`**

**Optional** - A callback function that will be called when the promo code changes.

The callback receives the full promo code object when a code is applied, or `null` when the code is removed.

```tsx theme={null}
<WhopCheckoutEmbed
	onPromoCodeChanged={(promoCode) => {
		if (promoCode) {
			console.log(
				"Promo applied:",
				promoCode.code,
				promoCode.type,
				promoCode.amount,
			);
		} else {
			console.log("Promo removed");
		}
	}}
	planId="plan_XXXXXXXXX"
/>
```

#### **`styles`**

**Optional** - Customize the padding of the checkout embed container.

The `styles` prop accepts a `container` object with the following properties:

| Property        | Description                          | Default |
| --------------- | ------------------------------------ | ------- |
| `paddingTop`    | Top padding in pixels                | `32`    |
| `paddingBottom` | Bottom padding in pixels             | `32`    |
| `paddingLeft`   | Left padding in pixels               | `32`    |
| `paddingRight`  | Right padding in pixels              | `32`    |
| `paddingY`      | Shorthand for top and bottom padding | `32`    |
| `paddingX`      | Shorthand for left and right padding | `32`    |

Individual properties take precedence over their shorthand equivalents.

```tsx theme={null}
<WhopCheckoutEmbed
	planId="plan_XXXXXXXXX"
	styles={{ container: { paddingX: 0 } }}
/>
```

```tsx theme={null}
<WhopCheckoutEmbed
	planId="plan_XXXXXXXXX"
	styles={{
		container: {
			paddingLeft: 16,
			paddingRight: 16,
			paddingTop: 0,
			paddingBottom: 0,
		},
	}}
/>
```

### Full example

```tsx theme={null}
import { WhopCheckoutEmbed } from "@whop/checkout/react";

export default function Home() {
	return (
		<WhopCheckoutEmbed
			fallback={<>loading...</>}
			planId="plan_XXXXXXXXX"
			sessionId="ch_XXXXXXXXX"
			returnUrl="https://yoursite.com/checkout/complete"
			theme="light"
			hidePrice={false}
		/>
	);
}
```

## Other websites

### Step 1: Add the script tag

To embed checkout, you need to add the following script tag into the `<head>` of your page:

```md theme={null}
<script
  async
  defer
  src="https://js.whop.com/static/checkout/loader.js"
></script>
```

### Step 2: Add the checkout element

To create a checkout element, you need to include the following attributes on an element in your page:

```md theme={null}
<div
  data-whop-checkout-plan-id="plan_XXXXXXXXX"
  data-whop-checkout-return-url="https://yoursite.com/checkout/complete"
></div>
```

This will mount an iframe inside of the element with the plan id you provided.

The `data-whop-checkout-return-url` is required to handle redirects from external payment providers. When redirected, check the `status` query parameter:

* **success**: The payment succeeded. Use the receipt information to render a success page.
* **error**: The payment failed or was canceled. Remount the checkout so your customer can try again.

### Step 3: **(optional)** Configure - Programmatic controls

First, attach an `id` to the checkout container:

```md theme={null}
<div id="whop-embedded-checkout" data-whop-checkout-plan-id="plan_XXXXXXXXX"></div>
```

#### **`submit`**

To submit checkout programmatically, you can use the `submit` method on the checkout element.

```js theme={null}
wco.submit("whop-embedded-checkout");
```

#### **`getEmail`**

To get the email of the user who is checking out, you can use the `getEmail` method on the checkout element.

```js theme={null}
const email = await wco.getEmail("whop-embedded-checkout");
console.log(email);
```

#### **`setEmail`**

To set the email of the user who is checking out, you can use the `setEmail` method on the checkout element.

```js theme={null}
wco.setEmail("whop-embedded-checkout", "example@domain.com");
```

#### **`getAddress`**

To get the address of the user who is checking out, you can use the `getAddress` method on the checkout element.

```js theme={null}
const address = await wco.getAddress("whop-embedded-checkout");
console.log(address);
```

#### **`setAddress`**

To set the address of the user who is checking out, you can use the `setAddress` method on the checkout element.

<Note>
  This method will only work if the address form is hidden. You can hide the
  address form by setting the `data-whop-checkout-hide-address` prop to `true`.
</Note>

```js theme={null}
try {
	await wco.setAddress("whop-embedded-checkout", {
		name: "John Doe",
		country: "US",
		line1: "123 Main St",
		city: "Any Town",
		state: "CA",
		postalCode: "12345",
	});
} catch (error) {
	console.error(error);
}
```

### Step 4: **(optional)** Configure - Available attributes

#### **`data-whop-checkout-plan-id`**

**Required** - The plan id you want to checkout.

> To get your plan id, you need to first create a plan in the **Manage Pricing** section on your whop page.

#### **`data-whop-checkout-theme`**

**Optional** - The theme you want to use for the checkout.

Possible values are `light`, `dark` or `system`.

```md theme={null}
<div data-whop-checkout-theme="light" data-whop-checkout-plan-id="plan_XXXXXXXXX"></div>
```

#### **`data-whop-checkout-theme-accent-color`**

**Optional** - The accent color to apply to the checkout embed.

Accepts any hex color like `#7c3aed` — the embed derives the full accent palette from it, including a legible button text color. The following named palettes are also supported:

* `tomato`
* `red`
* `ruby`
* `crimson`
* `pink`
* `plum`
* `purple`
* `violet`
* `iris`
* `cyan`
* `teal`
* `jade`
* `green`
* `grass`
* `brown`
* `blue`
* `orange`
* `indigo`
* `sky`
* `mint`
* `yellow`
* `amber`
* `lime`
* `lemon`
* `magenta`
* `gold`
* `bronze`
* `gray`

```md theme={null}
<div data-whop-checkout-theme-accent-color="green" data-whop-checkout-plan-id="plan_XXXXXXXXX"></div>
```

#### **`data-whop-checkout-theme-background-color`**

**Optional** - The background color to apply to the checkout embed.

Accepts a hex color like `#09090b`. The embed automatically picks light or dark text and tints its panels and inputs to fit the color, overriding `data-whop-checkout-theme`.

```md theme={null}
<div data-whop-checkout-theme-background-color="#09090b" data-whop-checkout-plan-id="plan_XXXXXXXXX"></div>
```

#### **`data-whop-checkout-theme-border-radius`**

**Optional** - The corner radius to apply to the checkout embed, in pixels.

Inputs and containers use the value as-is; buttons scale proportionally (1.5×). Pass `0` for square corners.

```md theme={null}
<div data-whop-checkout-theme-border-radius="8" data-whop-checkout-plan-id="plan_XXXXXXXXX"></div>
```

#### **`data-whop-checkout-session`**

**Optional** - The session id to use for the checkout.

This can be used to attach metadata to a checkout by first creating a session through the API and then passing the session id to the checkout element.

```md theme={null}
<div data-whop-checkout-session="ch_XXXXXXXXX" data-whop-checkout-plan-id="plan_XXXXXXXXX"></div>
```

#### **`data-whop-checkout-return-url`**

**Optional** - The URL to redirect the user to after checkout completes.

```md theme={null}
<div data-whop-checkout-return-url="https://yoursite.com/checkout/complete" data-whop-checkout-plan-id="plan_XXXXXXXXX"></div>
```

#### **`data-whop-checkout-affiliate-code`**

**Optional** - The affiliate code to use for the checkout.

```md theme={null}
<div data-whop-checkout-affiliate-code="tristan" data-whop-checkout-plan-id="plan_XXXXXXXXX"></div>
```

#### **`data-whop-checkout-hide-price`**

**Optional** - Set to `true` to hide the price in the embedded checkout form.

Defaults to `false`

```md theme={null}
<div data-whop-checkout-hide-price="true" data-whop-checkout-plan-id="plan_XXXXXXXXX"></div>
```

#### **`data-whop-checkout-hide-submit-button`**

**Optional** - Set to `true` to hide the submit button in the embedded checkout form.

Defaults to `false`

<Note>
  When using this Option, you will need to [programmatically submit](#submit)
  the checkout form.
</Note>

```md theme={null}
<div data-whop-checkout-hide-submit-button="true" data-whop-checkout-plan-id="plan_XXXXXXXXX"></div>
```

#### **`data-whop-checkout-hide-tos`**

**Optional** - Set to `true` to hide the terms and conditions in the embedded checkout form.

Defaults to `false`

```md theme={null}
<div data-whop-checkout-hide-tos="true" data-whop-checkout-plan-id="plan_XXXXXXXXX"></div>
```

#### **`data-whop-checkout-skip-redirect`**

**Optional** - Set to `true` to skip the final redirect and keep the top frame loaded.

Defaults to `false`

```md theme={null}
<div data-whop-checkout-skip-redirect="true" data-whop-checkout-plan-id="plan_XXXXXXXXX"></div>
```

#### **`data-whop-checkout-adaptive-pricing`**

**Optional** - Set to `true` to enable adaptive pricing on the embedded checkout. When enabled and supported for the plan, prices are presented in the buyer's local currency.

Defaults to `false` — embedded checkouts must opt in explicitly. Buyers will be charged in the plan's base currency unless this is set.

See [Listening for currency changes](#listening-for-currency-changes) to react to currency events from the embed or switch currencies programmatically.

```md theme={null}
<div data-whop-checkout-adaptive-pricing="true" data-whop-checkout-plan-id="plan_XXXXXXXXX"></div>
```

#### **`data-whop-checkout-collect-phone-numbers`**

**Optional** - Set to `true` to require a phone number, `optional` to show a phone number field that buyers may leave blank, or `false` to disable collection. When omitted, the plan's feature setting is used.

```md theme={null}
<div data-whop-checkout-collect-phone-numbers="optional" data-whop-checkout-plan-id="plan_XXXXXXXXX"></div>
```

#### **`data-whop-checkout-collect-shipping`**

**Optional** - Set to `true` to collect a shipping address during checkout, even when the plan does not require one. To hide the shipping address instead, use `shipping.address.hidden`.

```md theme={null}
<div data-whop-checkout-collect-shipping="true" data-whop-checkout-plan-id="plan_XXXXXXXXX"></div>
```

#### **`data-whop-checkout-locale`**

**Optional** - The language the checkout renders in, as a locale code (e.g. `"es"`, `"fr"`, `"pt"`). When omitted, the checkout falls back to the buyer's browser language preference.

```md theme={null}
<div data-whop-checkout-locale="es" data-whop-checkout-plan-id="plan_XXXXXXXXX"></div>
```

#### **`data-whop-checkout-on-complete`**

**Optional** - The callback to call when the checkout succeeds

<Note>This option will set `data-whop-checkout-skip-redirect` to `true`</Note>

```html theme={null}
<script>
	window.onCheckoutComplete = (planId, receiptId) => {
		console.log(planId, receiptId);
	};
</script>

<div
	data-whop-checkout-on-complete="onCheckoutComplete"
	data-whop-checkout-plan-id="plan_XXXXXXXXX"
></div>
```

#### **`data-whop-checkout-on-state-change`**

**Optional** - The callback to call when state of the checkout changes

This can be used when programmatically submitting the checkout embed.

Possible values are `loading`, `ready`, `disabled`.

```html theme={null}
<script>
	window.onCheckoutStateChange = (state) => {
		console.log(state);
	};
</script>

<div
	data-whop-checkout-on-state-change="onCheckoutStateChange"
	data-whop-checkout-plan-id="plan_XXXXXXXXX"
></div>
```

#### **`data-whop-checkout-skip-utm`**

By default any utm params from the main page will be forwarded to the checkout embed.

**Optional** - Set to `true` to prevent the automatic forwarding of utm parameters

Defaults to `false`

#### **`data-whop-checkout-prefill-*`**

Used to prefill the email or address in the embedded checkout form. This setting can be helpful when integrating the embed into a funnel that collects the email prior to payment already.

```md theme={null}
<div data-whop-checkout-prefill-email="example@domain.com" data-whop-checkout-plan-id="plan_XXXXXXXXX"></div>

<div 
	data-whop-checkout-prefill-name="John Doe"
	data-whop-checkout-prefill-address-country="US"
	data-whop-checkout-prefill-address-line1="123 Main St"
	data-whop-checkout-prefill-address-line2=""
	data-whop-checkout-prefill-address-city="Any Town"
	data-whop-checkout-prefill-address-state="CA"
	data-whop-checkout-prefill-address-postal-code="12345"
	data-whop-checkout-plan-id="plan_XXXXXXXXX"
></div>

<div data-whop-checkout-prefill-address-name="John Doe" data-whop-checkout-plan-id="plan_XXXXXXXXX"></div>
```

#### **`data-whop-checkout-hide-email`**

**Optional** - Set to `true` to hide the email input in the embedded checkout form. Make sure to display the users email in the parent page when setting this attribute.

Defaults to `false`

<Note>
  Use this in conjunction with the `data-whop-checkout-prefill-email` attribute
  or the `setEmail` method to control the email input.
</Note>

```md theme={null}
<div data-whop-checkout-hide-email="true" data-whop-checkout-plan-id="plan_XXXXXXXXX"></div>
```

#### **`data-whop-checkout-disable-email`**

**Optional** - Set to `true` to disable the email input in the embedded checkout form.

Defaults to `false`

<Note>
  Use this in conjunction with the `data-whop-checkout-prefill-email` attribute
  or the `setEmail` method to control the email input.
</Note>

```md theme={null}
<div data-whop-checkout-disable-email="true" data-whop-checkout-plan-id="plan_XXXXXXXXX"></div>
```

#### **`data-whop-checkout-hide-address`**

**Optional** - Set to `true` to hide the address form in the embedded checkout form.

Defaults to `false`

<Note>
  This method will only work if the address form is hidden. You can hide the
  address form by setting the `data-whop-checkout-hide-address` prop to `true`.
</Note>

```md theme={null}
<div data-whop-checkout-hide-address="true" data-whop-checkout-plan-id="plan_XXXXXXXXX"></div>
```

#### **`data-whop-checkout-setup-future-usage`**

**Optional** - The setup future usage to use for the checkout. When using the `chargeUser` API you need to set this to `off_session`. This will filter out payment methods that are not supported with that API.

```md theme={null}
<div data-whop-checkout-setup-future-usage="off_session" data-whop-checkout-plan-id="plan_XXXXXXXXX"></div>
```

#### **`data-whop-checkout-environment`**

**Optional** - The environment to use for the checkout.

Possible values are `production` or `sandbox`.

Defaults to `production`

<Note>
  When using `sandbox`, make sure to use a sandbox plan ID. Sandbox plans can be
  created in the [sandbox dashboard](https://sandbox.whop.com/dashboard).
</Note>

```md theme={null}
<div data-whop-checkout-environment="sandbox" data-whop-checkout-plan-id="plan_XXXXXXXXX"></div>
```

#### **`data-whop-checkout-on-address-validation-error`**

**Optional** - The callback to call when the address validation error occurs.

<Note>
  This method will only work if the address form is hidden. You can hide the
  address form by setting the `data-whop-checkout-hide-address` prop to `true`.
</Note>

```html theme={null}
<script>
	window.onAddressValidationError = (error) => {
		console.log(error);
	};
</script>

<div
	data-whop-checkout-on-address-validation-error="onAddressValidationError"
	data-whop-checkout-plan-id="plan_XXXXXXXXX"
></div>
```

#### **`data-whop-checkout-on-payment-error`**

**Optional** - The callback to call when checkout payment processing fails.

The callback receives an error object with a human readable `message` and an optional machine readable `code`. It fires for declines on submit as well as failures detected while the payment is processing, for example after 3D Secure or a redirect to an external payment provider.

```html theme={null}
<script>
	window.onPaymentError = (error) => {
		console.log(error.message, error.code);
	};
</script>

<div
	data-whop-checkout-on-payment-error="onPaymentError"
	data-whop-checkout-plan-id="plan_XXXXXXXXX"
></div>
```

#### **`data-whop-checkout-on-promo-code-changed`**

**Optional** - The callback to call when the promo code changes.

The callback receives the full promo code object when a code is applied, or `null` when the code is removed.

```html theme={null}
<script>
	window.onPromoCodeChanged = (promoCode) => {
		if (promoCode) {
			console.log(
				"Promo applied:",
				promoCode.code,
				promoCode.type,
				promoCode.amount,
			);
		} else {
			console.log("Promo removed");
		}
	};
</script>

<div
	data-whop-checkout-on-promo-code-changed="onPromoCodeChanged"
	data-whop-checkout-plan-id="plan_XXXXXXXXX"
></div>
```

#### **`data-whop-checkout-style-*`**

**Optional** - Customize the padding of the checkout embed container.

The attribute pattern is `data-whop-checkout-style-container-{property}` where `{property}` is a kebab-case padding property.

| Attribute                                           | Description                          | Default |
| --------------------------------------------------- | ------------------------------------ | ------- |
| `data-whop-checkout-style-container-padding-top`    | Top padding in pixels                | `32`    |
| `data-whop-checkout-style-container-padding-bottom` | Bottom padding in pixels             | `32`    |
| `data-whop-checkout-style-container-padding-left`   | Left padding in pixels               | `32`    |
| `data-whop-checkout-style-container-padding-right`  | Right padding in pixels              | `32`    |
| `data-whop-checkout-style-container-padding-y`      | Shorthand for top and bottom padding | `32`    |
| `data-whop-checkout-style-container-padding-x`      | Shorthand for left and right padding | `32`    |

Individual properties take precedence over their shorthand equivalents.

```md theme={null}
<div
  data-whop-checkout-plan-id="plan_XXXXXXXXX"
  data-whop-checkout-style-container-padding-x="0"
></div>
```

```md theme={null}
<div
  data-whop-checkout-plan-id="plan_XXXXXXXXX"
  data-whop-checkout-style-container-padding-left="16"
  data-whop-checkout-style-container-padding-right="16"
  data-whop-checkout-style-container-padding-top="0"
  data-whop-checkout-style-container-padding-bottom="0"
></div>
```

### Full example

```md theme={null}
<!DOCTYPE html>
<html>
	<head>
		<meta charset="utf-8">
		<meta name="viewport" content="width=device-width">
		<script
			async
			defer
  			src="https://js.whop.com/static/checkout/loader.js"
		></script>
		<title>Whop embedded checkout example</title>
		<style>
			div {
				box-sizing: border-box;
			}
			body {
				margin: 0
			}
		</style>
	</head>
	<body>
		<div
			data-whop-checkout-plan-id="plan_XXXXXXXXX"
			data-whop-checkout-session="ch_XXXXXXXXX"
			data-whop-checkout-return-url="https://yoursite.com/checkout/complete"
			data-whop-checkout-theme="light"
			data-whop-checkout-hide-price="false"
			style="height: fit-content; overflow: hidden; max-width: 50%;"
		></div>
	</body>
</html>
```

## Listening for currency changes

When [`adaptivePricing`](#adaptivepricing) is enabled, the embedded checkout exposes the available and active currencies through callbacks, a programmatic getter, and a setter for switching currencies.

The currency snapshot has the following shape:

| Field               | Type             | Description                                                                                                                    |
| ------------------- | ---------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `base_currency`     | `string`         | The plan's base currency (ISO 4217).                                                                                           |
| `optional_currency` | `string \| null` | The buyer's local currency when different from `base_currency` and supported. `null` when only the base currency is available. |
| `current_currency`  | `string`         | The currency currently displayed.                                                                                              |
| `exchange_rate`     | `number \| null` | Rate from `base_currency` to `current_currency`. `null` when no conversion is active.                                          |

### React

Use the `onCurrenciesAvailable` and `onCurrencyChanged` props to react to currency events, or read the latest snapshot from the embed's ref via `getAvailableCurrencies()`. Send the buyer to a different supported currency with `setDisplayCurrency()`.

```tsx theme={null}
import { useRef } from "react";
import { WhopCheckoutEmbed, type WhopCheckoutEmbedControls } from "@whop/react/checkout";

function Checkout() {
	const ref = useRef<WhopCheckoutEmbedControls>(null);

	return (
		<>
			<WhopCheckoutEmbed
				ref={ref}
				adaptivePricing
				planId="plan_XXXXXXXXX"
				onCurrenciesAvailable={(snapshot) => console.log(snapshot)}
				onCurrencyChanged={({ currency, exchange_rate }) =>
					console.log(currency, exchange_rate)
				}
			/>
			<button
				onClick={async () => {
					const snapshot = ref.current?.getAvailableCurrencies();
					if (snapshot?.optional_currency) {
						await ref.current?.setDisplayCurrency(snapshot.optional_currency);
					}
				}}
			>
				Use local currency
			</button>
		</>
	);
}
```

### HTML / vanilla JS

Set callbacks via data attributes pointing to functions on `window`. Use `wco.getAvailableCurrencies(identifier)` to read the latest snapshot and `wco.setDisplayCurrency(identifier, currency)` to switch.

```html theme={null}
<script>
	window.onCurrenciesAvailable = (snapshot) => console.log(snapshot);
	window.onCurrencyChanged = ({ currency, exchange_rate }) =>
		console.log(currency, exchange_rate);
</script>

<div
	id="whop-embedded-checkout"
	data-whop-checkout-plan-id="plan_XXXXXXXXX"
	data-whop-checkout-adaptive-pricing="true"
	data-whop-checkout-on-currencies-available="onCurrenciesAvailable"
	data-whop-checkout-on-currency-changed="onCurrencyChanged"
></div>

<script>
	document.querySelector("#switch").addEventListener("click", async () => {
		const snapshot = wco.getAvailableCurrencies("whop-embedded-checkout");
		if (snapshot?.optional_currency) {
			await wco.setDisplayCurrency(
				"whop-embedded-checkout",
				snapshot.optional_currency,
			);
		}
	});
</script>
```

<Note>
  `setDisplayCurrency` only accepts currencies present in the most recent
  `onCurrenciesAvailable` snapshot — any other currency is rejected with
  `WhopCheckoutSetDisplayCurrencyError`.
</Note>

## Apple Pay

Apple Pay allows customers to pay using their Apple Wallet, providing a seamless checkout experience on Safari and iOS devices. To enable Apple Pay on your embedded checkout, you need to verify ownership of your domain.

<Card title="Set up Apple Pay" icon="apple" href="/payments/apple-pay">
  Learn how to verify your domain and enable Apple Pay for embedded checkout
</Card>

<Note>
  When using the `hideSubmitButton` option in React, `@whop/checkout@0.0.43` or
  later is required for Apple Pay to appear in the embed.
</Note>

## Platform-specific guides

<CardGroup cols={3}>
  <Card title="Framer" icon="browser" href="/third-party-integrations/embedded-checkouts/framer-checkout">
    Embed checkout on Framer with Apple Pay support
  </Card>

  <Card title="ClickFunnels" icon="browser" href="/third-party-integrations/embedded-checkouts/clickfunnels-checkout">
    Embed checkout on ClickFunnels pages
  </Card>

  <Card title="GoHighLevel" icon="browser" href="/third-party-integrations/embedded-checkouts/gohighlevel-checkout">
    Embed checkout on GoHighLevel funnels
  </Card>
</CardGroup>

## FAQs

<AccordionGroup>
  <Accordion title="Why is my checkout not loading?">
    Make sure you've correctly replaced `plan_XXXXXXXXX` or `PLAN_ID_HERE` in the code snippets with your actual Plan ID from the Whop dashboard. Also verify that the script tag is properly loaded in the `<head>` section if using HTML/JS.
  </Accordion>

  <Accordion title="Where do I find my Plan ID?">
    Go to your **Dashboard** > **Checkout links** > Click the **three dots (⋮)** on your pricing option > Hover over **Details** > Click the ID (starts with `plan_`) to copy it.
  </Accordion>

  <Accordion title="Can I embed multiple checkouts on the same page?">
    Yes, you can add multiple checkout embeds with different Plan IDs. Each embed operates independently.
  </Accordion>

  <Accordion title="How do I change the checkout theme?">
    For React: add `theme="dark"` or `theme="light"` as a property. For HTML: add `data-whop-checkout-theme="dark"` to your div element.
  </Accordion>

  <Accordion title="Can I hide the price in the embedded checkout?">
    Yes, add `hidePrice={true}` in React or `data-whop-checkout-hide-price="true"` in HTML to hide the price display.
  </Accordion>

  <Accordion title="What happens after a customer completes checkout?">
    By default, customers are redirected to your whop. You can customize this by setting a custom redirect URL or skipping the redirect entirely.
  </Accordion>

  <Accordion title="How do I prevent the redirect after checkout?">
    Use `skipRedirect={true}` in React or `data-whop-checkout-skip-redirect="true"` in HTML to keep users on the same page.
  </Accordion>

  <Accordion title="Is the embedded checkout mobile-responsive?">
    Yes, the checkout automatically adapts to different screen sizes and devices.
  </Accordion>

  <Accordion title="Can I customize the checkout's appearance with CSS?">
    You can style the wrapper using the `.whop-checkout-wrapper iframe` CSS class, but the checkout content itself cannot be modified for security reasons.
  </Accordion>

  <Accordion title="Can I pre-fill customer information?">
    Yes, use `prefill={{ email: "customer@example.com" }}` in React or `data-whop-checkout-prefill-email="customer@example.com"` in HTML.
  </Accordion>
</AccordionGroup>


> ## Documentation Index
> Fetch the complete documentation index at: https://docs.whop.com/llms.txt
> Use this file to discover all available pages before exploring further.

# One click checkout button

> Drop a single Apple Pay, Google Pay, or Whop Pay button on your site that opens Whop checkout in a dialog

export const OneClickCheckoutDemo = ({planId, returnUrl}) => {
  const [mounted, setMounted] = React.useState(false);
  const [ready, setReady] = React.useState(false);
  const subscribe = React.useCallback(onChange => {
    const observer = new MutationObserver(() => {
      onChange();
    });
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"]
    });
    return () => observer.disconnect();
  }, []);
  const getSnapshot = React.useCallback(() => {
    return document.documentElement.classList.contains("dark") ? "dark" : "light";
  }, []);
  const getServerSnapshot = React.useCallback(() => {
    return null;
  }, []);
  const theme = React.useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  React.useEffect(() => {
    const src = "https://js.whop.com/static/checkout/loader.js";
    if (!document.querySelector(`script[src="${src}"]`)) {
      const script = document.createElement("script");
      script.async = true;
      script.src = src;
      document.head.appendChild(script);
    }
    setMounted(true);
  }, []);
  const revealCleanup = React.useRef(null);
  const buttonRef = React.useCallback(node => {
    if (!node) {
      if (revealCleanup.current) revealCleanup.current();
      revealCleanup.current = null;
      return;
    }
    let revealed = false;
    const reveal = () => {
      if (revealed) return;
      revealed = true;
      const skeleton = document.getElementById("one-click-demo-skeleton");
      if (skeleton) skeleton.style.display = "none";
      setReady(true);
    };
    node.addEventListener("ready", reveal, {
      once: true
    });
    const errorObserver = new MutationObserver(() => {
      if (node.dataset.state === "error") reveal();
    });
    errorObserver.observe(node, {
      attributes: true,
      attributeFilter: ["data-state"]
    });
    const revealTimeout = setTimeout(reveal, 10000);
    revealCleanup.current = () => {
      revealed = true;
      clearTimeout(revealTimeout);
      errorObserver.disconnect();
      node.removeEventListener("ready", reveal);
    };
  }, []);
  if (!mounted || !theme) return null;
  return React.createElement("whop-express-checkout-button", {
    ref: buttonRef,
    "plan-id": planId,
    "return-url": returnUrl,
    theme,
    style: {
      display: "block",
      opacity: ready ? 1 : 0,
      transition: "opacity 200ms ease"
    }
  });
};

## Try it (its real) 👇

<div style={{ position: "relative", minHeight: "55px" }}>
  <style>
    {`@keyframes occd-pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }`}
  </style>

  <div
    id="one-click-demo-skeleton"
    style={{
		position: "absolute",
		inset: 0,
		borderRadius: "8px",
		background: "rgba(128, 128, 128, 0.15)",
		animation: "occd-pulse 1.5s ease-in-out infinite",
	}}
  />

  <OneClickCheckoutDemo planId="plan_HmQiPLPPnvsFG" returnUrl="https://docs.whop.com/payments/one-click-checkout-button" />
</div>

## React setup

### Step 1: Install the package

```bash theme={null}
npm install @whop/checkout
```

### Step 2: Add the button

```tsx theme={null}
import { WhopExpressCheckoutButton } from "@whop/checkout/react";

export default function PricingCard() {
	return (
		<WhopExpressCheckoutButton
			planId="plan_XXXXXXXXX"
			returnUrl="https://yoursite.com/checkout/complete"
		/>
	);
}
```

The `returnUrl` is **required** on the one click checkout button (unlike the regular embedded checkout, where it's optional). Payments started here may complete inside the Whop Pay dialog via a redirect-based payment method (3DS, Sezzle, etc.) and the user needs somewhere to land that closes the loop on your page.

When the customer is redirected back, check the `status` query parameter:

* **success**: The payment succeeded.
* **error**: The payment failed or was canceled.

On success, the redirect also includes:

* **`payment_id`** — the id of the [payment](/api-reference/payments/payment). Use it to look up the payment on your backend or render a confirmation.
* **`setup_intent_id`** — set instead of `payment_id` when checkout didn't charge anything (e.g. saving a card for future use).
* **`state_id`** — the checkout session id.

### Step 3: **(optional)** Configure - Available properties

#### **`planId`**

**Required (or `checkoutConfigurationId`)** - The plan id you want to checkout. Provide either this or `checkoutConfigurationId`, not both.

#### **`checkoutConfigurationId`**

**Required (or `planId`)** - An API-created checkout configuration id. Use this to mount the button against a pre-configured checkout (e.g. with attached metadata, a pre-applied promo, or a multi-line cart) instead of creating a new session at mount time. Provide either this or `planId`, not both.

#### **`returnUrl`**

**Required** - The URL to return to after payment authorization flows.

#### **`methods`**

**Optional** - Which methods the button is allowed to render, in priority order. Defaults to `["apple-pay", "google-pay", "whop-pay"]`.

* `apple-pay` — the native Apple Pay button (Safari and other Apple Pay-capable browsers).
* `google-pay` — the native Google Pay button (Chrome, Android, and other Google Pay-capable browsers).
* `whop-pay` — a Whop Pay button that opens checkout in a dialog.

```tsx theme={null}
<WhopExpressCheckoutButton
	methods={["apple-pay"]}
	planId="plan_XXXXXXXXX"
	returnUrl="https://yoursite.com/checkout/complete"
/>
```

Wallet requests are strict: a `methods={["google-pay"]}` button only ever renders Google Pay — it never falls back to Apple Pay (and vice versa). If none of the allowed methods can render in the current browser, nothing renders and the `onExpressMethodResolved` callback fires with `{ rendered: "none" }`.

#### **`theme`**

**Optional** - The theme for the button and the dialog. Possible values are `light`, `dark`, or `system`.

#### **`themeOptions`**

**Optional** - Theme tuning for the Whop Pay dialog.

```tsx theme={null}
<WhopExpressCheckoutButton
	planId="plan_XXXXXXXXX"
	returnUrl="https://yoursite.com/checkout/complete"
	theme="dark"
	themeOptions={{ accentColor: "violet", highContrast: true }}
/>
```

#### **`prefill`**

**Optional** - Prefill the email or address inside the Whop Pay dialog. Same shape as the regular embedded checkout — see [prefill options](/payments/checkout-embed#prefill).

```tsx theme={null}
<WhopExpressCheckoutButton
	planId="plan_XXXXXXXXX"
	returnUrl="https://yoursite.com/checkout/complete"
	prefill={{ email: "example@domain.com" }}
/>
```

#### **`affiliateCode`**

**Optional** - Attribute the sale to an affiliate.

#### **`promoCode`**

**Optional** - Apply a promo code on the session.

#### **`adaptivePricing`**

**Optional** - Set to `true` to present prices in the buyer's local currency where supported. Defaults to `false`.

#### **`skipRedirect`**

**Optional** - Set to `true` to skip the final redirect and keep your page loaded. Automatically `true` when `onComplete` is provided.

#### **`onComplete`**

**Optional** - Fires when the checkout completes successfully.

<Note>Setting this implies `skipRedirect = true`.</Note>

```tsx theme={null}
<WhopExpressCheckoutButton
	planId="plan_XXXXXXXXX"
	returnUrl="https://yoursite.com/checkout/complete"
	onComplete={(planId, receiptId) => {
		console.log("paid", planId, receiptId);
	}}
/>
```

#### **`onPaymentError`**

**Optional** - Fires when checkout payment processing fails, with a human readable `message` and an optional machine readable `code`.

```tsx theme={null}
<WhopExpressCheckoutButton
	planId="plan_XXXXXXXXX"
	returnUrl="https://yoursite.com/checkout/complete"
	onPaymentError={(error) => {
		console.log(error.message, error.code);
	}}
/>
```

#### **`onExpressMethodResolved`**

**Optional** - Fires once the button decides which method it will render.

```tsx theme={null}
<WhopExpressCheckoutButton
	planId="plan_XXXXXXXXX"
	returnUrl="https://yoursite.com/checkout/complete"
	onExpressMethodResolved={({ rendered }) => {
		// rendered: "apple-pay" | "google-pay" | "whop-pay" | "none"
		if (rendered === "none") hidePricingCard();
	}}
/>
```

`rendered: "none"` means the button won't show anything — typically because the only requested method is `apple-pay` and the browser can't render it. Use this to hide the surrounding slot so you don't leave an empty space on the page.

## What renders

The button picks one method per browser, in this order:

| Browser                                          | Renders                  | Notes                                     |
| ------------------------------------------------ | ------------------------ | ----------------------------------------- |
| Safari (macOS/iOS) with an Apple Pay card set up | Native Apple Pay button  | Submits inline; no dialog                 |
| Chrome / Android with Google Pay                 | Native Google Pay button | Submits inline; no dialog                 |
| Anything else                                    | Whop Pay button          | Opens checkout in a dialog over your page |

If you only request `apple-pay` and the browser can't render it, the button signals back to your page (via the `express-method-resolved` event) so you can hide the slot.

## Other websites

### Step 1: Add the script tag

```html theme={null}
<script
	async
	defer
	src="https://js.whop.com/static/checkout/loader.js"
></script>
```

### Step 2: Add the button

The one click checkout button is a custom element. Once the script loads it registers `<whop-express-checkout-button>`:

```html theme={null}
<whop-express-checkout-button
	plan-id="plan_XXXXXXXXX"
	return-url="https://yoursite.com/checkout/complete"
></whop-express-checkout-button>
```

### Step 3: **(optional)** Configure - Available attributes

| Attribute                              | Required                             | Description                                                                                 |
| -------------------------------------- | ------------------------------------ | ------------------------------------------------------------------------------------------- |
| `plan-id`                              | yes (or `checkout-configuration-id`) | The plan to check out.                                                                      |
| `checkout-configuration-id`            | yes (or `plan-id`)                   | An API-created checkout configuration to resume instead of creating a new session at mount. |
| `return-url`                           | yes                                  | Where to return after redirect-based authorization.                                         |
| `methods`                              | no                                   | Comma-separated list — `apple-pay`, `google-pay`, `whop-pay`. Defaults to all.              |
| `theme`                                | no                                   | `light`, `dark`, or `system`.                                                               |
| `theme-accent-color`                   | no                                   | Frosted UI accent color name (e.g. `violet`).                                               |
| `theme-high-contrast`                  | no                                   | `"true"` or `"false"`.                                                                      |
| `prefill-email`                        | no                                   | Prefill the buyer's email.                                                                  |
| `prefill-name`                         | no                                   | Prefill the buyer's name.                                                                   |
| `prefill-address-line1`                | no                                   | Prefill billing address line 1.                                                             |
| `prefill-address-line2`                | no                                   | Prefill billing address line 2.                                                             |
| `prefill-address-city`                 | no                                   | Prefill billing city.                                                                       |
| `prefill-address-state`                | no                                   | Prefill billing state.                                                                      |
| `prefill-address-country`              | no                                   | Prefill billing country code.                                                               |
| `prefill-address-postal-code`          | no                                   | Prefill billing postal code.                                                                |
| `prefill-shipping-name`                | no                                   | Prefill shipping name.                                                                      |
| `prefill-shipping-address-line1`       | no                                   | Prefill shipping address line 1.                                                            |
| `prefill-shipping-address-line2`       | no                                   | Prefill shipping address line 2.                                                            |
| `prefill-shipping-address-city`        | no                                   | Prefill shipping city.                                                                      |
| `prefill-shipping-address-state`       | no                                   | Prefill shipping state.                                                                     |
| `prefill-shipping-address-country`     | no                                   | Prefill shipping country code.                                                              |
| `prefill-shipping-address-postal-code` | no                                   | Prefill shipping postal code.                                                               |
| `affiliate-code`                       | no                                   | Affiliate attribution.                                                                      |
| `promo-code`                           | no                                   | Apply a promo code on the session.                                                          |
| `state-id`                             | no                                   | Resume a previously-created session.                                                        |
| `adaptive-pricing`                     | no                                   | `"true"` to present buyer-local currency.                                                   |
| `skip-redirect`                        | no                                   | `"true"` to keep your page loaded after payment.                                            |
| `setup-future-usage`                   | no                                   | Set to `off_session` to save the payment method for future charges.                         |
| `environment`                          | no                                   | Override the API environment (rarely needed).                                               |
| `wuid`                                 | no                                   | Stable per-buyer identifier for analytics.                                                  |

### Step 4: Listening for events

The custom element dispatches DOM events you can listen for:

```html theme={null}
<whop-express-checkout-button
	id="my-button"
	plan-id="plan_XXXXXXXXX"
	return-url="https://yoursite.com/checkout/complete"
></whop-express-checkout-button>

<script>
	const button = document.getElementById("my-button");

	button.addEventListener("express-method-resolved", (event) => {
		// event.detail.rendered: "apple-pay" | "google-pay" | "whop-pay" | "none"
		if (event.detail.rendered === "none") button.style.display = "none";
	});

	button.addEventListener("complete", (event) => {
		// event.detail: { planId, receiptOrSetupIntentId }
		console.log("paid", event.detail);
	});

	button.addEventListener("payment-error", (event) => {
		// event.detail: { message, code? }
		console.log("payment failed", event.detail);
	});

	button.addEventListener("overlay-open", () => {
		// the Whop Pay dialog opened
	});

	button.addEventListener("overlay-close", () => {
		// the Whop Pay dialog closed (cancelled or completed)
	});
</script>
```

| Event                     | Fires when                                                                                                                           |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `ready`                   | The button has mounted and measured itself.                                                                                          |
| `express-method-resolved` | The button decided which method it will render. `event.detail.rendered` is `"apple-pay"`, `"google-pay"`, `"whop-pay"`, or `"none"`. |
| `overlay-open`            | The Whop Pay dialog opened.                                                                                                          |
| `overlay-close`           | The Whop Pay dialog closed (for any reason).                                                                                         |
| `complete`                | Payment completed successfully. `event.detail` has `planId` and `receiptOrSetupIntentId`.                                            |
| `payment-error`           | Payment processing failed. `event.detail` has a human readable `message` and an optional machine readable `code`.                    |
