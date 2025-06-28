import matplotlib.pyplot as plt
import pandas as pd

ideal_data = {
    "CallID": list(range(1, 16)),
    "ActualSeverity": [
        4, 4, 2, 2, 4, 2, 4, 2, 1, 4,
        2, 2, 4, 4, 1, 4, 4
    ],
    "PredictedSeverities": [
        [4, 4, 4, 4, 4],  
        [2, 4, 4, 4, 4], 
        [2, 2, 2, 2, 2], 
        [1, 2, 4, 2, 2],
        [4, 4, 4, 4, 4], 
        [4, 2, 2, 2, 2],  
        [4, 4, 4, 4, 4],
        [1, 1, 2, 2, 2],  
        [1, 1, 1, 1, 1], 
        [4, 4, 4, 4, 4], 
        [2, 2, 2, 2, 2],  
        [2, 2, 2, 2, 2], 
        [4, 4, 4, 4, 4],  
        [1, 1, 4, 4, 4],
        [1, 1, 1, 1, 1], 
        [2, 4, 4, 4, 4], 
        [4, 4, 4, 4, 4]  
    ]
}

# Build long-form DataFrame
rows = []
for call_id, true_severity, preds in zip(ideal_data["CallID"], ideal_data["ActualSeverity"], ideal_data["PredictedSeverities"]):
    for i, pred in enumerate(preds):
        rows.append({
            "CallID": call_id,
            "SentenceIndex": i + 1,
            "PredictedSeverity": pred,
            "ActualSeverity": true_severity,
            "Correct": int(pred == true_severity)
        })

ideal_df = pd.DataFrame(rows)

# Compute accuracy at each sentence index
accuracy_by_sentence = ideal_df.groupby("SentenceIndex")["Correct"].mean().reset_index()

# Plotting
plt.figure(figsize=(10, 6))
plt.plot(accuracy_by_sentence["SentenceIndex"], accuracy_by_sentence["Correct"],
         marker='o', linestyle='-', linewidth=2, color='blue')

plt.xlabel("Sentence Position in Call", fontsize=16)
plt.ylabel("Accuracy of Predicting True Call Severity", fontsize=16)
plt.title("Model Accuracy in Predicting Overall Severity with Increasing Context", fontsize=18)
plt.xticks(accuracy_by_sentence["SentenceIndex"], [f"Sentence {i}" for i in accuracy_by_sentence["SentenceIndex"]], fontsize=13)
plt.yticks(fontsize=13)
plt.ylim(0, 1.05)
plt.grid(True, linestyle='--')

# Annotate points
for i, acc in zip(accuracy_by_sentence["SentenceIndex"], accuracy_by_sentence["Correct"]):
    plt.text(i, acc + 0.03, f"{acc:.0%}", ha='center', fontsize=13)

plt.tight_layout()
plt.show()
