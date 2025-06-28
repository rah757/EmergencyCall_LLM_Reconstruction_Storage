import matplotlib.pyplot as plt
import seaborn as sns
import numpy as np
from sklearn.metrics import confusion_matrix

# Updated ground truth and predicted severity values
ground_truth_severity_updated = [1,1,1,1,1,1,1,1, 2,2,2,2,2,2,2,2,2, 4,4,4,4,4,4,4,4,4]
predicted_severity_updated =    [1,1,2,1,2,1,2,1, 2,1,2,2,4,2,2,2,1, 4,4,4,2,4,4,4,2,4]

# Generate the confusion matrix with updated values
severity_labels = [1, 2, 4]  # Mild (1), Moderate (2), Severe (4)
conf_matrix_updated = confusion_matrix(ground_truth_severity_updated, predicted_severity_updated, labels=severity_labels)

# Normalize confusion matrix per row (i.e., by actual class counts)
row_sums = conf_matrix_updated.sum(axis=1, keepdims=True)
conf_matrix_percent = (conf_matrix_updated / row_sums) * 100  # Convert to percentages

# Plot the updated confusion matrix
plt.figure(figsize=(8, 6))
sns.heatmap(conf_matrix_percent, annot=True, fmt='.1f', cmap='Blues', 
            xticklabels=['Mild', 'Moderate', 'Severe'], 
            yticklabels=['Mild', 'Moderate', 'Severe'], cbar_kws={'label': 'Percentage'})

plt.xlabel("Model-Predicted Severity")
plt.ylabel("Actual Severity")
plt.title("Confusion Matrix of Severity Classification")

plt.tight_layout()
plt.show()
