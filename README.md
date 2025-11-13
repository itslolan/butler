# Butler - Financial Health Tracker

Butler helps users keep track of their expenses and financial health using AI-powered analysis of bank and credit card statements.

## Features

- Upload bank and credit card statements (images)
- AI-powered extraction of financial markers using GPT-4o
- Visual dashboard showing financial health metrics
- Track spending patterns, credit utilization, payment regularity, and more

## Getting Started

1. Install dependencies:
```bash
npm install
```

2. Set up environment variables:
Create a `.env.local` file with:
```
OPENAI_API_KEY=your_openai_api_key_here
```

3. Run the development server:
```bash
npm run dev
```

4. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Financial Markers Extracted

- Carry-forward balance behavior
- Cash advances
- Credit utilization ratio
- Volatility of spending
- Payment regularity
- Category-level financial behavior
- Refunds & reversals
- Subscription creep

