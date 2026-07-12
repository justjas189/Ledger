# Roadmap & Implementation Plan: AI-Powered Features (v1.2)

This technical specification details the proposed AI-powered upgrades to the application, leveraging the newly integrated Gemini 1.5 Flash backend. These features are designed to transition the application from a manual expense tracker to an intelligent financial assistant.

---

## 1. Feature Specifications

### 1. Natural Language Expense Entry (The "Siri" Mode)
*   **The Feature:** Add a single "Quick Add" input field where a user can type conversational inputs like: *"Spent ₱500 on dinner at Jollibee yesterday"* [cite: 1].
*   **Why it works:** The LLM parses this sentence to extract the entity (Jollibee), the category (Dining), the amount (500), and the date (July 10, 2026), filling all the form fields automatically [cite: 1].

### 2. Intelligent Receipt Reconciliation
*   **The Improvement:** Pass the raw, noisy Tesseract OCR text to Gemini. Ask it to clean the text, identify the merchant, and normalize the amount [cite: 1].
*   **Why it works:** This drastically reduces the number of times a user has to manually correct a scanned receipt, making the "Scan a receipt" feature feel like a professional product [cite: 1].

### 3. Financial Literacy & Spending Insights
*   **The Feature:** Create an "Ask my Budget" button in the dashboard [cite: 1].
*   **The Prompt:** Send the user's spending data for the last 30 days to the LLM and ask: *"Based on my spending this month, am I on track to meet my savings goal? Give me one piece of advice to save more next month."* [cite: 1].
*   **Why it works:** It turns a static dashboard into an active coach. This aligns perfectly with the existing work on the "GaFi" (Gamified Money Management) project [cite: 1].

### 4. Automated Subscription Audits
*   **The Feature:** Add a "Subscription Detector" tab [cite: 1].
*   **How it works:** The LLM analyzes expense history to detect if a specific category or merchant (e.g., "Netflix," "Spotify," or a gym membership) appears at regular intervals. It can then flag these as subscriptions and ask if the user wants to set a recurring budget for them [cite: 1].

### 5. Multi-Currency & Language Normalization
*   **The Improvement:** If a user types *"Nag-grocery ako sa SM worth 2000 pesos,"* the LLM can interpret this seamlessly, categorize it as "Groceries," and correctly handle the currency conversion or formatting, even if the user mixes English and Filipino terminology [cite: 1].

---

## 2. Implementation Priority Recommendation

To maximize impact for internship applications, the following development order is recommended:

1.  **Natural Language Entry:** This is the most visible "wow" factor for a demo.
2.  **Cleaned Receipt Scanning:** This provides immediate utility and solves the "noisy OCR" problem.
3.  **Spending Insights:** This leverages ML specialization and demonstrates the ability to build high-level analytical features.