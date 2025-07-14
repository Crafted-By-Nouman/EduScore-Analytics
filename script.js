// Main Application
document.addEventListener("DOMContentLoaded", function () {
  // Initialize the app
  initApp();
});

function initApp() {
  // Theme Toggle
  const themeToggle = document.getElementById("themeToggle");
  themeToggle.addEventListener("change", toggleTheme);

  // Check for saved theme preference
  if (localStorage.getItem("darkMode") === "enabled") {
    document.body.classList.add("dark-mode");
    themeToggle.checked = true;
  }

  // Initialize subject table with default 3 subjects
  initializeSubjects();

  // Set up event listeners
  setupEventListeners();
}

function toggleTheme() {
  document.body.classList.toggle("dark-mode");

  // Save preference to localStorage
  if (document.body.classList.contains("dark-mode")) {
    localStorage.setItem("darkMode", "enabled");
  } else {
    localStorage.setItem("darkMode", "disabled");
  }

  // Update chart colors if chart exists
  if (window.performanceChart) {
    updatePerformanceChartColors();
  }
}

function initializeSubjects() {
  const subjectTableBody = document.getElementById("subjectTableBody");
  subjectTableBody.innerHTML = "";
}

function addSubjectRow(subjectData = null) {
  const subjectTableBody = document.getElementById("subjectTableBody");
  const rowId = Date.now(); // Unique ID for each row

  // Remove empty state if present
  const emptyState = subjectTableBody.querySelector(".empty-state");
  if (emptyState) {
    emptyState.remove();
  }

  const row = document.createElement("tr");
  row.id = `subjectRow-${rowId}`;
  row.className = "fade-in";

  row.innerHTML = `
          <td>
            <input type="text" class="input-field subject-name" placeholder="Subject ${
              subjectTableBody.children.length + 1
            }" value="${subjectData?.name || ""}" required>
          </td>
          <td>
            <input type="number" class="input-field obtained-marks" placeholder="0" min="0" value="${
              subjectData?.obtained || ""
            }">
          </td>
          <td>
            <input type="number" class="input-field total-marks" placeholder="100" min="1" value="${
              subjectData?.total || "100"
            }">
          </td>
          <td class="percentage-cell">-</td>
          <td class="grade-cell">-</td>
          <td class="status-cell">-</td>
          <td class="subject-actions">
            <button class="action-btn remove-row-btn" title="Remove this subject">
              <i class="fas fa-times"></i>
            </button>
            <button class="action-btn duplicate-row-btn" title="Duplicate this subject">
              <i class="fas fa-copy"></i>
            </button>
          </td>
        `;

  subjectTableBody.appendChild(row);

  // Add event listeners to the new row
  addRowEventListeners(row);

  // Focus on the subject name field for new rows
  if (!subjectData) {
    setTimeout(() => {
      row.querySelector(".subject-name").focus();
    }, 0);
  }

  return row;
}

function addRowEventListeners(row) {
  const obtainedInput = row.querySelector(".obtained-marks");
  const totalInput = row.querySelector(".total-marks");
  const subjectNameInput = row.querySelector(".subject-name");
  const removeBtn = row.querySelector(".remove-row-btn");
  const duplicateBtn = row.querySelector(".duplicate-row-btn");

  // Validate inputs
  subjectNameInput.addEventListener("blur", function () {
    if (!this.value.trim()) {
      this.classList.add("input-error");
    } else {
      this.classList.remove("input-error");
    }
    calculateResults();
  });

  obtainedInput.addEventListener("blur", function () {
    validateMarksInput(this, totalInput);
    calculateResults();
  });

  totalInput.addEventListener("blur", function () {
    validateMarksInput(this, obtainedInput, true);
    calculateResults();
  });

  // Recalculate when any input changes
  subjectNameInput.addEventListener("input", debounce(calculateResults, 300));
  obtainedInput.addEventListener("input", debounce(calculateResults, 300));
  totalInput.addEventListener("input", debounce(calculateResults, 300));

  // Remove row button
  removeBtn.addEventListener("click", function () {
    removeSubjectRow(row);
  });

  // Duplicate row button
  duplicateBtn.addEventListener("click", function () {
    const subjectData = {
      name: row.querySelector(".subject-name").value,
      obtained: row.querySelector(".obtained-marks").value,
      total: row.querySelector(".total-marks").value,
    };
    addSubjectRow(subjectData);
    calculateResults();
  });
}

function validateMarksInput(input, compareInput = null, isTotalInput = false) {
  const value = parseFloat(input.value);

  // Check if value is a valid number
  if (isNaN(value)) {
    input.value = "";
    return;
  }

  // Check for negative values
  if (value < 0) {
    input.value = "0";
    showToast("Marks cannot be negative", "warning");
    return;
  }

  // Check if obtained marks exceed total marks
  if (compareInput && !isTotalInput) {
    const totalValue = parseFloat(compareInput.value) || 100;
    if (value > totalValue) {
      input.value = totalValue;
      showToast("Obtained marks cannot exceed total marks", "warning");
    }
  }

  // Check if total marks is less than obtained marks
  if (compareInput && isTotalInput) {
    const obtainedValue = parseFloat(compareInput.value) || 0;
    if (value < obtainedValue) {
      input.value = obtainedValue;
      showToast("Total marks cannot be less than obtained marks", "warning");
    }
  }

  // Check if total marks is zero
  if (isTotalInput && value === 0) {
    input.value = "1";
    showToast("Total marks cannot be zero", "warning");
  }
}

function removeSubjectRow(row) {
  row.classList.add("fade-out");
  setTimeout(() => {
    row.remove();
    calculateResults();
    // Show empty state if no subjects left
    if (
      document.querySelectorAll("#subjectTableBody tr:not(.empty-state)")
        .length === 0
    ) {
      showEmptyState();
    }
  }, 300);
}

function showEmptyState() {
  const subjectTableBody = document.getElementById("subjectTableBody");
  subjectTableBody.innerHTML = `
          <tr class="empty-state">
            <td colspan="7">
              <i class="fas fa-book-open"></i>
              <h3>No Subjects Added</h3>
              <p>Click the "+ Add Subject" button to get started</p>
            </td>
          </tr>
        `;
  document.getElementById("resultsCard").style.display = "none";
}

function calculateResults() {
  showLoading(true);

  // Use setTimeout to allow UI to update before heavy calculations
  setTimeout(() => {
    const subjects = [];
    const passingThreshold =
      parseFloat(document.getElementById("passingThreshold").value) || 33;
    let totalObtained = 0;
    let totalMax = 0;
    let allPassed = true;
    let hasInvalidSubjects = false;

    // Check if we have any subjects (not counting empty state)
    const subjectRows = document.querySelectorAll(
      "#subjectTableBody tr:not(.empty-state)"
    );
    if (subjectRows.length === 0) {
      showEmptyState();
      showLoading(false);
      return;
    }

    // Gather data from all subject rows
    subjectRows.forEach((row) => {
      const nameInput = row.querySelector(".subject-name");
      const name = nameInput.value.trim() || `Subject ${row.rowIndex}`;
      const obtained =
        parseFloat(row.querySelector(".obtained-marks").value) || 0;
      const total = parseFloat(row.querySelector(".total-marks").value) || 100;

      // Validate subject name
      if (!nameInput.value.trim()) {
        nameInput.classList.add("input-error");
        hasInvalidSubjects = true;
      } else {
        nameInput.classList.remove("input-error");
      }

      // Calculate percentage
      const percentage = total > 0 ? (obtained / total) * 100 : 0;
      const grade = calculateGrade(percentage);
      const passed = percentage >= passingThreshold;

      if (!passed) allPassed = false;

      // Update the row display
      row.querySelector(".percentage-cell").textContent =
        percentage.toFixed(2) + "%";
      row.querySelector(".grade-cell").textContent = grade;
      row.querySelector(".grade-cell").className = `grade-cell grade-${grade}`;
      row.querySelector(".status-cell").textContent = passed ? "Pass" : "Fail";
      row.querySelector(".status-cell").className = `status-cell ${
        passed ? "status-pass" : "status-fail"
      }`;

      // Add to totals
      totalObtained += obtained;
      totalMax += total;

      // Add to subjects array for chart
      subjects.push({
        name,
        percentage,
        grade,
        passed,
      });
    });

    // Calculate overall results
    const overallPercentage =
      totalMax > 0 ? (totalObtained / totalMax) * 100 : 0;
    const overallGrade = calculateGrade(overallPercentage);

    // Update summary
    document.getElementById("totalMarks").textContent =
      totalObtained.toFixed(2);
    document.getElementById("totalMaxMarks").textContent = totalMax.toFixed(2);
    document.getElementById("overallPercentage").textContent =
      overallPercentage.toFixed(2) + "%";
    document.getElementById("cumulativeGrade").textContent = overallGrade;
    document.getElementById(
      "cumulativeGrade"
    ).className = `grade-${overallGrade}`;
    document.getElementById("overallStatus").textContent = allPassed
      ? "Pass"
      : "Fail";
    document.getElementById("overallStatus").className = allPassed
      ? "status-pass"
      : "status-fail";

    // Show results card if not shown
    document.getElementById("resultsCard").style.display = "block";

    // Update motivation message
    updateMotivationMessage(overallPercentage, allPassed, hasInvalidSubjects);

    // Update performance chart
    updatePerformanceChart(subjects);

    // Trigger confetti for excellent results
    if (overallGrade === "A" && !hasInvalidSubjects) {
      triggerConfetti();
    }

    showLoading(false);
  }, 100);
}

function calculateGrade(percentage) {
  if (percentage >= 90) return "A";
  if (percentage >= 80) return "B";
  if (percentage >= 70) return "C";
  if (percentage >= 60) return "D";
  if (percentage >= 50) return "E";
  return "F";
}

function updateMotivationMessage(
  percentage,
  allPassed,
  hasInvalidSubjects = false
) {
  const motivationElement = document.getElementById("motivationMessage");
  let message = "";
  let icon = "fas fa-info-circle";

  if (hasInvalidSubjects) {
    message = "⚠️ Please fill in all subject names for accurate results.";
    icon = "fas fa-exclamation-triangle";
  } else if (isNaN(percentage)) {
    message = "Enter your marks to see your results!";
    icon = "fas fa-info-circle";
  } else if (percentage >= 90) {
    message =
      "🌟 Outstanding performance! You're at the top of your game! Keep up the excellent work!";
    icon = "fas fa-star";
  } else if (percentage >= 80) {
    message =
      "👍 Excellent work! You're doing great! A little more effort and you'll reach the top!";
    icon = "fas fa-thumbs-up";
  } else if (percentage >= 70) {
    message =
      "💪 Good job! Keep up the good work! Focus on your weak areas to improve further.";
    icon = "fas fa-award";
  } else if (percentage >= 50) {
    message =
      "👏 You passed! There's room for improvement, but you're on the right track. Analyze where you can do better.";
    icon = "fas fa-check-circle";
  } else if (!allPassed) {
    message =
      "😔 You didn't pass all subjects. Don't give up! Analyze where you need improvement and focus on those areas.";
    icon = "fas fa-exclamation-triangle";
  } else {
    message =
      "📚 You passed, but consider spending more time on challenging subjects. Identify your weaknesses and work on them.";
    icon = "fas fa-book";
  }

  motivationElement.innerHTML = `
          <i class="${icon}" style="margin-right: 10px;"></i>
          <span>${message}</span>
        `;
}

let performanceChart = null;

function updatePerformanceChart(subjects) {
  const ctx = document.getElementById("performanceChart").getContext("2d");

  // Destroy previous chart if it exists
  if (performanceChart) {
    performanceChart.destroy();
  }

  // Prepare data for chart
  const labels = subjects.map((sub) => sub.name);
  const percentages = subjects.map((sub) => sub.percentage);
  const backgroundColors = subjects.map((sub) =>
    sub.passed ? "rgba(75, 192, 192, 0.7)" : "rgba(255, 99, 132, 0.7)"
  );

  performanceChart = new Chart(ctx, {
    type: "bar",
    data: {
      labels: labels,
      datasets: [
        {
          label: "Percentage",
          data: percentages,
          backgroundColor: backgroundColors,
          borderColor: backgroundColors.map((color) =>
            color.replace("0.7", "1")
          ),
          borderWidth: 1,
        },
      ],
    },
    options: getChartOptions(),
  });
}

function updatePerformanceChartColors() {
  if (performanceChart) {
    performanceChart.options = getChartOptions();
    performanceChart.update();
  }
}

function getChartOptions() {
  const isDarkMode = document.body.classList.contains("dark-mode");

  return {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      y: {
        beginAtZero: true,
        max: 100,
        title: {
          display: true,
          text: "Percentage (%)",
          color: isDarkMode ? "#f8f9fa" : "#212529",
        },
        grid: {
          color: isDarkMode ? "rgba(255, 255, 255, 0.1)" : "rgba(0, 0, 0, 0.1)",
        },
        ticks: {
          color: isDarkMode ? "#f8f9fa" : "#212529",
        },
      },
      x: {
        title: {
          display: true,
          text: "Subjects",
          color: isDarkMode ? "#f8f9fa" : "#212529",
        },
        grid: {
          display: false,
        },
        ticks: {
          color: isDarkMode ? "#f8f9fa" : "#212529",
        },
      },
    },
    plugins: {
      tooltip: {
        callbacks: {
          afterLabel: function (context) {
            const index = context.dataIndex;
            const subjects = performanceChart.data.labels.map((label, i) => ({
              name: label,
              percentage: performanceChart.data.datasets[0].data[i],
              grade: calculateGrade(performanceChart.data.datasets[0].data[i]),
            }));
            return `Grade: ${subjects[index].grade}`;
          },
        },
        backgroundColor: isDarkMode ? "#1e1e1e" : "#ffffff",
        titleColor: isDarkMode ? "#ffffff" : "#000000",
        bodyColor: isDarkMode ? "#ffffff" : "#000000",
        borderColor: isDarkMode ? "#333" : "#ddd",
        borderWidth: 1,
      },
      legend: {
        display: false,
      },
    },
  };
}

function triggerConfetti() {
  // Only trigger confetti if not in print mode
  if (window.matchMedia && !window.matchMedia("print").matches) {
    confetti({
      particleCount: 150,
      spread: 70,
      origin: { y: 0.6 },
      colors: ["#4361ee", "#3a0ca3", "#4cc9f0", "#f72585", "#7209b7"],
    });
  }
}

function saveResults() {
  // Use html2canvas to capture the results card as an image
  const resultsCard = document.getElementById("resultsCard");

  if (!resultsCard || resultsCard.style.display === "none") {
    showToast("No results to save", "error");
    return;
  }

  // Show loading indicator
  showLoading(true);

  // Use html2canvas to capture the results
  html2canvas(resultsCard, {
    scale: 2,
    logging: false,
    useCORS: true,
    allowTaint: true,
    backgroundColor: document.body.classList.contains("dark-mode")
      ? "#1a1a1a"
      : "#ffffff",
  })
    .then((canvas) => {
      // Create download link
      const link = document.createElement("a");
      link.download = "results-snapshot.png";
      link.href = canvas.toDataURL("image/png");
      link.click();

      showToast("Results saved as image!", "success");
      showLoading(false);
    })
    .catch((err) => {
      console.error("Error saving image:", err);
      showToast("Error saving results as image", "error");
      showLoading(false);
    });
}

function printResults() {
  window.print();
}

function showLoading(show) {
  const loadingIndicator = document.getElementById("loadingIndicator");
  loadingIndicator.style.display = show ? "flex" : "none";
}

function showToast(message, type) {
  const toast = document.getElementById("toast");
  const toastIcon = toast.querySelector(".toast-icon");
  const toastMessage = toast.querySelector(".toast-message");

  // Set icon based on type
  let iconClass = "fas fa-info-circle";
  if (type === "success") iconClass = "fas fa-check-circle";
  if (type === "error") iconClass = "fas fa-exclamation-circle";
  if (type === "warning") iconClass = "fas fa-exclamation-triangle";

  // Update toast content
  toastIcon.className = `fas ${iconClass} toast-icon`;
  toastMessage.textContent = message;

  // Set toast class
  toast.className = "toast";
  if (type) toast.classList.add(type);

  // Show toast
  toast.classList.add("show");

  // Hide after 3 seconds
  setTimeout(() => {
    toast.classList.remove("show");
  }, 3000);
}

function debounce(func, wait) {
  let timeout;
  return function () {
    const context = this;
    const args = arguments;
    clearTimeout(timeout);
    timeout = setTimeout(() => {
      func.apply(context, args);
    }, wait);
  };
}

function setupEventListeners() {
  // Add subject button
  document
    .getElementById("addSubject")
    .addEventListener("click", addSubjectRow);

  // Remove all subjects button
  document
    .getElementById("removeAllSubjects")
    .addEventListener("click", function () {
      const subjectTableBody = document.getElementById("subjectTableBody");
      if (
        subjectTableBody.querySelectorAll("tr:not(.empty-state)").length > 0
      ) {
        // Add fade-out animation to all rows
        subjectTableBody
          .querySelectorAll("tr:not(.empty-state)")
          .forEach((row) => {
            row.classList.add("fade-out");
          });

        setTimeout(() => {
          subjectTableBody.innerHTML = "";
          showEmptyState();
        }, 300);
      } else {
        showToast("No subjects to remove", "warning");
      }
    });

  // Save results button (now saves as image)
  document.getElementById("saveResults").addEventListener("click", saveResults);

  // Print button
  document
    .getElementById("printResults")
    .addEventListener("click", printResults);

  // Passing threshold input
  document
    .getElementById("passingThreshold")
    .addEventListener("input", debounce(calculateResults, 300));

  // Calculate results when page loads if there are values
  calculateResults();

  // Add keyboard shortcut for adding subjects (Ctrl+Enter or Cmd+Enter)
  document.addEventListener("keydown", function (e) {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      addSubjectRow();
    }
  });
}

window.addEventListener("load", () => {
  const modal = document.getElementById("popupModal");
  const screenWidth = window.innerWidth || document.documentElement.clientWidth;
  console.log(screenWidth);
  if (786 >= screenWidth) {
    modal.style.display = "flex";
  }
});

function closeModal() {
  document.getElementById("popupModal").style.display = "none";
}
