import plotly.graph_objects as go

# Data for 2024:
# Total Crimes: 8,420 
# Total Arrests (Part I & II): 350 + 393 + 1407 = 2150 
# Open Cases: 3,743 
# Closed Cases: 4,677 

# Nodes in the Sankey Diagram
labels = [
    "Total Reported Crimes (2024)", # Node 0
    "Arrest Made",                   # Node 1
    "No Arrest Made",                # Node 2
    "Case Closed",                   # Node 3
    "Case Remained Open"             # Node 4
]

# Links between the nodes
source_nodes = [0, 0, 1, 2] # From
target_nodes = [1, 2, 3, 4] # To
values = [
    2150,                           # Crimes with an arrest
    8420 - 2150,                    # Crimes with no arrest
    4677,                           # Cases Closed (assuming all closed cases had an arrest for this model, a simplification)
    3743                            # Cases Open (assuming all open cases had no arrest for this model, a simplification)
]
# NOTE: The direct link from arrest status to open/closed status is not provided in the data.
# This visualization models a simplified flow for illustrative purposes. A more precise model
# would require data linking specific cases to their arrest and closure status.

fig = go.Figure(data=[go.Sankey(
    node=dict(
      pad=15,
      thickness=20,
      line=dict(color="black", width=0.5),
      label=labels,
      color="royalblue"
    ),
    link=dict(
      source=source_nodes,
      target=target_nodes,
      value=values
    ))])

fig.update_layout(
    title_text="<b>Simplified Case Resolution Flow in Albany (2024)</b><br><i>Illustrates attrition from reported crimes to case outcomes</i>",
    font=dict(size=10, family="Arial, sans-serif")
)

# To generate the HTML file
# fig.write_html("case_resolution_sankey_2024.html")
fig.show()