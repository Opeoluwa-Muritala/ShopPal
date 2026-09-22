# Day 4 Final Demo Readiness Checklist — Naija Marketplace (EcomBot)

This checklist tracks readiness for the final hackathon demo and presentation. All items must be checked off before live judging.

---

## 1. Frontend (FE)
- [ ] Vendor signup and login flows work smoothly
- [ ] Product catalog table displays all products with stock and price
- [ ] Bulk CSV upload works with sample CSV and surfaces clear validation feedback
- [ ] Orders dashboard displays live order status badges (Pending, Paid, Delivered)
- [ ] Mobile responsive layout passes on phone viewports

---

## 2. Backend
- [ ] FastAPI `/api/health` returns status 200
- [ ] Twilio webhook receiver successfully ingests incoming WhatsApp messages
- [ ] Claude LLM integration parses intent and returns catalog answers with system prompt
- [ ] Paystack payment link generation and webhook verification functional
- [ ] PostgreSQL database relationships and Redis session state working

---

## 3. Demo
- [ ] Test WhatsApp device joined to Twilio Sandbox
- [ ] Sample vendor seeded with 5 realistic Nigerian retail products
- [ ] Full end-to-end flow verified: Inquire -> Add to Cart -> Pay via Paystack -> Order appears on Dashboard
- [ ] Backup screen recording video prepared and accessible offline

---

## 4. Presentation
- [ ] 5-minute pitch slide deck completed
- [ ] Clear problem statement, target market size, and demo narrative rehearsed
- [ ] Tech stack and architecture diagram prepared for Q&A
