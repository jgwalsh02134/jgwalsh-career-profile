import plotly.express as px
import pandas as pd

# Data extracted from the 'Crimes by NEU Area' table 
neu_data = {
    'Neighborhood': ['West Hill', 'Pine Hills', 'South End', 'Arbor Hill Concerned Citizens', 'Delaware Area',
                     'Downtown', 'N. Albany/Shaker Park', 'Sheridan Hollow', 'Pine Bush', 'Mansion', 'Helderberg',
                     'Woodlawn', 'Second Avenue', 'Washington Square', 'Ten Broeck Triangle', 'Eagle Hill',
                     'Washington Park', 'Historic Pastures Homeowners Association', 'Melrose', 'Whitehall',
                     'Buckingham Lake', 'Port of Albany', 'Normanskill Area', 'Unknown/Not in NEU Zone'],
    'Total_2021_2024': [4173, 3967, 2804, 1978, 1639, 1124, 1112, 909, 817, 671, 543, 542, 488, 474,
                          462, 391, 397, 389, 347, 296, 245, 163, 92, 11786],
    'Crimes_2021': [1019, 934, 673, 426, 376, 231, 302, 229, 125, 185, 116, 119, 110, 107, 109, 77, 79, 98, 99, 54, 40, 35, 18, 2703],
    'Crimes_2022': [1187, 1007, 795, 523, 427, 307, 346, 266, 260, 207, 142, 121, 131, 141, 125, 77, 113, 97, 87, 81, 53, 42, 28, 2980],
    'Crimes_2023': [979, 1156, 675, 453, 434, 279, 226, 189, 226, 135, 146, 155, 118, 105, 137, 132, 91, 104, 83, 87, 87, 40, 26, 3519],
    'Crimes_2024': [988, 870, 661, 576, 402, 307, 238, 225, 206, 144, 139, 147, 129, 121, 91, 105, 114, 90, 78, 74, 65, 46, 20, 2584]
}
df_neu = pd.DataFrame(neu_data)

# Determine the year with the highest crime count for color-coding
df_neu['Peak_Year'] = df_neu[['Crimes_2021', 'Crimes_2022', 'Crimes_2023', 'Crimes_2024']].idxmax(axis=1).str.replace('Crimes_', '')


fig = px.treemap(df_neu, path=[px.Constant("All Neighborhoods"), 'Neighborhood'], values='Total_2021_2024',
                 color='Peak_Year',
                 color_discrete_map={'2021':'#fee08b', '2022':'#fc8d59', '2023':'#d53e4f', '2024':'#9e0142'},
                 custom_data=['Crimes_2021', 'Crimes_2022', 'Crimes_2023', 'Crimes_2024'])

fig.update_traces(
    hovertemplate='<b>%{label}</b><br>Total Crimes (2021-24): %{value}<br>2021: %{customdata[0]}<br>2022: %{customdata[1]}<br>2023: %{customdata[2]}<br>2024: %{customdata[3]}<extra></extra>'
)

fig.update_layout(
    title_text='<b>Crime Distribution by Neighborhood (2021-2024)</b><br><i>Color Indicates Peak Crime Year</i>',
    font=dict(family="Arial, sans-serif", size=12, color="black"),
    margin = dict(t=60, l=25, r=25, b=25)
)

fig.write_html("interactive_neighborhood_treemap.html")
fig.show()