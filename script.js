/**
 * NMT Invoice Generator - Core Logic
 */

document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('invoiceForm');
    const invoiceSection = document.querySelector('.invoice-section');
    const successMessage = document.getElementById('successMessage');
    const previewActions = document.getElementById('previewActions');
    const invoiceCard = document.getElementById('invoiceCard');

    // DOM Elements for Invoice Preview
    const invNumber = document.getElementById('invNumber');
    const invDate = document.getElementById('invDate');
    const invCustomerName = document.getElementById('invCustomerName');
    const invCustomerAddress = document.getElementById('invCustomerAddress');
    const invCustomerPhone = document.getElementById('invCustomerPhone');
    const invAmountPaid = document.getElementById('invAmountPaid');
    const invSubtotal = document.getElementById('invSubtotal');
    const invDiscountRow = document.getElementById('invDiscountRow');
    const invDiscountCodeLabel = document.getElementById('invDiscountCodeLabel');
    const invDiscountAmount = document.getElementById('invDiscountAmount');
    const invTaxableValue = document.getElementById('invTaxableValue');
    const invGST = document.getElementById('invGST');
    const invTotal = document.getElementById('invTotal');
    const invAdvancePaid = document.getElementById('invAdvancePaid');
    const invBalanceDue = document.getElementById('invBalanceDue');
    const invStatusBadge = document.getElementById('invStatusBadge');

    // History Table Elements
    const historyTableBody = document.getElementById('historyTableBody');
    const emptyHistoryMsg = document.getElementById('emptyHistoryMsg');
    const historyTable = document.getElementById('historyTable');
    const syncStatus = document.getElementById('syncStatus');

    // Action Buttons
    const downloadPdfBtn = document.getElementById('downloadPdfBtn');
    const exportDatabaseBtn = document.getElementById('exportDatabaseBtn');
    const linkFileBtn = document.getElementById('linkFileBtn');
    const clearHistoryBtn = document.getElementById('clearHistoryBtn');

    // State
    let currentInvoiceData = null;
    let invoiceHistory = JSON.parse(localStorage.getItem('nmt_invoice_history')) || [];
    let masterFileHandle = null;

    // Initial Table Render
    renderHistoryTable();

    // Load most recent invoice into preview if history exists
    if (invoiceHistory.length > 0) {
        currentInvoiceData = invoiceHistory[invoiceHistory.length - 1];
        updateInvoicePreview(currentInvoiceData);
        invoiceSection.classList.remove('empty-state');
        previewActions.classList.remove('hidden');
    } else {
        // Initialize the UI state (Invoice preview greyed out initially)
        invoiceSection.classList.add('empty-state');
    }

    // Phone Number Input Restriction
    const phoneInput = document.getElementById('phoneNumber');
    phoneInput.addEventListener('input', (e) => {
        e.target.value = e.target.value.replace(/\D/g, '');
    });

    /**
     * Helper Function: Generate a Random Invoice ID
     */
    function generateInvoiceID() {
        const year = new Date().getFullYear();
        const randNum = Math.floor(1000 + Math.random() * 9000);
        return `INV-${year}-${randNum}`;
    }

    /**
     * Helper Function: Format Date neatly
     */
    function formatDateString(dateInput) {
        let dateObj = dateInput ? new Date(dateInput) : new Date();
        return dateObj.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    }

    /**
     * Helper Function: Format Number as Currency
     */
    function formatCurrency(numberVal) {
        const parsed = parseFloat(numberVal);
        return isNaN(parsed) ? '0.00' : parsed.toFixed(2);
    }

    /**
     * Render the History Table
     */
    function renderHistoryTable() {
        historyTableBody.innerHTML = '';

        if (invoiceHistory.length === 0) {
            emptyHistoryMsg.classList.remove('hidden');
            historyTable.classList.add('hidden');
            return;
        }

        emptyHistoryMsg.classList.add('hidden');
        historyTable.classList.remove('hidden');

        [...invoiceHistory].reverse().forEach(inv => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td><strong>${inv.invoiceNo}</strong></td>
                <td>${inv.name}</td>
                <td>${inv.date}</td>
                <td>${inv.phone}</td>
                <td class="text-right">Rs ${formatCurrency(inv.total)}</td>
                <td class="text-right">Rs ${formatCurrency(inv.advance)}</td>
                <td class="text-right"><strong class="${inv.balance > 0 ? 'text-danger' : 'text-success'}">Rs ${formatCurrency(inv.balance)}</strong></td>
            `;
            historyTableBody.appendChild(row);
        });
    }

    /**
     * PDF Download Implementation - High Reliability Version (Protocol Safe)
     */
    async function downloadPDF() {
        if (!currentInvoiceData) {
            alert("Please generate an invoice first.");
            return;
        }

        const element = document.getElementById('invoiceCard');
        const logoImg = element.querySelector('.company-logo');
        if (!element) return;

        // "Safe Capture" Mode: Temporarily hide the local image to prevent canvas tainting
        // on the file:// protocol, which is what usually causes the download to fail.
        let logoSrc = "";
        if (logoImg) {
            logoSrc = logoImg.src;
            logoImg.style.display = "none"; // Hide image
            
            // Add a temporary text-based logo for the PDF
            const textLogo = document.createElement('div');
            textLogo.id = "tempTextLogo";
            textLogo.innerHTML = `<h3 style="color:#4f46e5; margin-bottom: 5px;">Nminustwo Solutions</h3>`;
            logoImg.parentNode.insertBefore(textLogo, logoImg);
        }

        const originalBg = element.style.backgroundColor;
        element.style.backgroundColor = "#ffffff";

        try {
            const canvas = await html2canvas(element, {
                scale: 2,
                backgroundColor: "#ffffff",
                useCORS: false, // Local files don't support CORS anyway
                allowTaint: true // Allow capturing the rest of the content
            });

            const imgData = canvas.toDataURL('image/png');
            const pdf = new jspdf.jsPDF('p', 'mm', 'a4');
            const imgProps = pdf.getImageProperties(imgData);
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;

            pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
            pdf.save(`Invoice_${currentInvoiceData.invoiceNo}.pdf`);
            
            console.log("PDF downloaded successfully (Safe Mode)");
        } catch (err) {
            console.error("PDF Error:", err);
            alert("Your browser security settings are preventing automatic PDF creation from local files. Please use the 'Print' button instead.");
        } finally {
            // Restore original UI
            element.style.backgroundColor = originalBg;
            if (logoImg) {
                logoImg.style.display = "block";
                const textLogo = document.getElementById('tempTextLogo');
                if (textLogo) textLogo.remove();
            }
        }
    }

    /**
     * File System Access: Link a master Excel file
     */
    async function linkMasterFile() {
        if (!window.showSaveFilePicker) {
            alert("Your browser does not support direct file saving. Please use a modern browser like Chrome or Edge for this feature.");
            return;
        }

        try {
            masterFileHandle = await window.showSaveFilePicker({
                suggestedName: `NMT_Invoice_Database_${new Date().getFullYear()}.xlsx`,
                types: [{
                    description: 'Excel Spreadsheet',
                    accept: { 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'] }
                }]
            });

            syncStatus.innerHTML = `<i class="fa-solid fa-circle-check"></i> Linked to: ${masterFileHandle.name}`;
            syncStatus.className = 'sync-status active';
            linkFileBtn.innerHTML = `<i class="fa-solid fa-rotate"></i> Change Linked File`;
            exportDatabaseBtn.classList.add('hidden'); 

            await saveToMasterFile();
            alert("File linked successfully!");
        } catch (err) {
            if (err.name !== 'AbortError') {
                console.error("Linking Error:", err);
            }
        }
    }

    /**
     * File System Access: Save data directly to the linked handle
     */
    async function saveToMasterFile() {
        if (!masterFileHandle) return;

        try {
            const data = invoiceHistory.map(inv => ({
                "Invoice No": inv.invoiceNo,
                "Customer Name": inv.name,
                "Payment Date": inv.date,
                "Billing Address": inv.address,
                "Phone Number": inv.phone,
                "Package Amount (Rs)": inv.amount,
                "Discount (Rs)": inv.discount,
                "Taxable Value (Rs)": inv.taxableValue,
                "GST 18% (Rs)": inv.gst,
                "Grand Total (Rs)": inv.total,
                "Advance Paid (Rs)": inv.advance,
                "Balance Due (Rs)": inv.balance
            }));

            const ws = XLSX.utils.json_to_sheet(data);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "Customer Database");
            const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
            const writable = await masterFileHandle.createWritable();
            await writable.write(excelBuffer);
            await writable.close();
        } catch (err) {
            console.error("Auto-save Error:", err);
            syncStatus.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i> Sync Error`;
            syncStatus.className = 'sync-status inactive';
            masterFileHandle = null;
        }
    }

    /**
     * Manual Excel Export (Fallback)
     */
    function manualExport() {
        if (invoiceHistory.length === 0) return;
        const data = invoiceHistory.map(inv => ({
            "Invoice No": inv.invoiceNo,
            "Customer Name": inv.name,
            "Payment Date": inv.date,
            "Billing Address": inv.address,
            "Phone Number": inv.phone,
            "Package Amount (Rs)": inv.amount,
            "Discount (Rs)": inv.discount,
            "Taxable Value (Rs)": inv.taxableValue,
            "GST 18% (Rs)": inv.gst,
            "Grand Total (Rs)": inv.total,
            "Advance Paid (Rs)": inv.advance,
            "Balance Due (Rs)": inv.balance
        }));
        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Customer Database");
        XLSX.writeFile(wb, `NMT_Manual_Export_${new Date().toISOString().split('T')[0]}.xlsx`);
    }

    /**
     * Clear All History
     */
    function clearHistory() {
        if (confirm("Are you sure you want to clear all customer records?")) {
            invoiceHistory = [];
            localStorage.removeItem('nmt_invoice_history');
            renderHistoryTable();
            if (masterFileHandle) saveToMasterFile();
        }
    }

    // Listeners
    downloadPdfBtn.addEventListener('click', (e) => { e.preventDefault(); downloadPDF(); });
    exportDatabaseBtn.addEventListener('click', (e) => { e.preventDefault(); manualExport(); });
    linkFileBtn.addEventListener('click', (e) => { e.preventDefault(); linkMasterFile(); });
    clearHistoryBtn.addEventListener('click', (e) => { e.preventDefault(); clearHistory(); });

    /**
     * Update the Invoice Preview DOM with data
     */
    function updateInvoicePreview(data) {
        invNumber.textContent = data.invoiceNo;
        invDate.textContent = data.date;
        invCustomerName.textContent = data.name;
        invCustomerAddress.textContent = data.address;
        invCustomerPhone.textContent = data.phone;
        invAmountPaid.textContent = formatCurrency(data.amount);
        invSubtotal.textContent = formatCurrency(data.amount);
        
        if (data.discount > 0) {
            invDiscountRow.classList.remove('hidden');
            const discountCode = document.getElementById('discountCode').value;
            invDiscountCodeLabel.textContent = discountCode || "NMT-PROMO";
            invDiscountAmount.textContent = formatCurrency(data.discount);
        } else {
            invDiscountRow.classList.add('hidden');
        }

        if (invTaxableValue) invTaxableValue.textContent = formatCurrency(data.taxableValue);
        if (invGST) invGST.textContent = formatCurrency(data.gst);
        if (invTotal) invTotal.textContent = formatCurrency(data.total);
        if (invAdvancePaid) invAdvancePaid.textContent = formatCurrency(data.advance);
        if (invBalanceDue) invBalanceDue.textContent = formatCurrency(data.balance);

        // Update Status Badge
        if (invStatusBadge) {
            if (data.balance <= 0) {
                invStatusBadge.innerHTML = '<i class="fa-solid fa-check"></i> PAID';
                invStatusBadge.className = 'status-badge paid';
            } else if (data.advance > 0) {
                invStatusBadge.innerHTML = '<i class="fa-solid fa-clock"></i> PARTIAL';
                invStatusBadge.className = 'status-badge partial';
            } else {
                invStatusBadge.innerHTML = '<i class="fa-solid fa-circle-exclamation"></i> UNPAID';
                invStatusBadge.className = 'status-badge unpaid';
            }
        }
    }

    /**
     * Form Submit Handler
     */
    form.addEventListener('submit', async function(e) {
        e.preventDefault();

        const name = document.getElementById('customerName').value;
        const dateInput = document.getElementById('paymentDate').value;
        const address = document.getElementById('billingAddress').value;
        const phone = document.getElementById('phoneNumber').value;
        
        // Robust field capture (supports both old and new IDs for caching safety)
        const amountEl = document.getElementById('packageAmount') || document.getElementById('amountPaid');
        const advanceEl = document.getElementById('advancePaid');
        const discountEl = document.getElementById('discountAmount');
        const codeEl = document.getElementById('discountCode');

        const amount = amountEl ? amountEl.value : '0';
        const advanceAmount = advanceEl ? advanceEl.value : '0';
        const discountAmount = discountEl ? discountEl.value : '0';
        const discountCode = codeEl ? codeEl.value : '';

        const rawAmount = parseFloat(amount);
        const rawAdvance = parseFloat(advanceAmount);
        const rawDiscount = parseFloat(discountAmount);

        if (rawDiscount > rawAmount) {
            alert('Discount amount cannot be greater than the Package Amount.');
            return;
        }

        const taxableValue = rawAmount - rawDiscount;
        const gstAmount = taxableValue * 0.18;
        const grandTotal = taxableValue + gstAmount;
        const balanceDue = grandTotal - rawAdvance;

        const invoiceID = generateInvoiceID();
        const formattedDate = formatDateString(dateInput);

        currentInvoiceData = {
            invoiceNo: invoiceID, 
            name, 
            date: formattedDate,
            address, 
            phone, 
            amount: rawAmount, 
            discount: rawDiscount, 
            taxableValue: taxableValue,
            gst: gstAmount,
            total: grandTotal,
            advance: rawAdvance,
            balance: balanceDue
        };

        invoiceHistory.push(currentInvoiceData);
        localStorage.setItem('nmt_invoice_history', JSON.stringify(invoiceHistory));

        renderHistoryTable();
        updateInvoicePreview(currentInvoiceData);
        
        invoiceSection.classList.remove('empty-state');
        invoiceCard.classList.remove('animate-in');
        void invoiceCard.offsetWidth;
        invoiceCard.classList.add('animate-in');
        successMessage.classList.remove('hidden');
        previewActions.classList.remove('hidden');

        if (masterFileHandle) {
            await saveToMasterFile();
        }

        setTimeout(() => successMessage.classList.add('hidden'), 3000);
    });
});
