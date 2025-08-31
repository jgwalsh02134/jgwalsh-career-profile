import plotly.graph_objects as go
import pandas as pd

# Data extracted from the monthly crime and arrest tables in the FOIL response 
crime_data = {
    'Date': pd.to_datetime(['2021-01-31', '2021-02-28', '2021-03-31', '2021-04-30', '2021-05-31', '2021-06-30', '2021-07-31', '2021-08-31', '2021-09-30', '2021-10-31', '2021-11-30', '2021-12-31',
             '2022-01-31', '2022-02-28', '2022-03-31', '2022-04-30', '2022-05-31', '2022-06-30', '2022-07-31', '2022-08-31', '2022-09-30', '2022-10-31', '2022-11-30', '2022-12-31',
             '2023-01-31', '2023-02-28', '2023-03-31', '2023-04-30', '2023-05-31', '2023-06-30', '2023-07-31', '2023-08-31', '2023-09-30', '2023-10-31', '2023-11-30', '2023-12-31',
             '2024-01-31', '2024-02-29', '2024-03-31', '2024-04-30', '2024-05-31', '2024-06-30', '2024-07-31', '2024-08-31', '2024-09-30', '2024-10-31', '2024-11-30', '2024-12-31']),
    'Crimes': [495, 586, 575, 634, 654, 713, 791, 775, 775, 803, 731, 732,
               719, 660, 690, 743, 915, 773, 959, 939, 785, 864, 735, 765,
               784, 720, 717, 802, 833, 786, 888, 892, 860, 848, 755, 698,
               644, 653, 682, 707, 848, 746, 781, 764, 712, 666, 562, 656]
}

arrest_data = {
    'Date': pd.to_datetime(['2021-01-31', '2021-02-28', '2021-03-31', '2021-04-30', '2021-05-31', '2021-06-30', '2021-07-31', '2021-08-31', '2021-09-30', '2021-10-31', '2021-11-30', '2021-12-31',
             '2022-01-31', '2022-02-28', '2022-03-31', '2022-04-30', '2022-05-31', '2022-06-30', '2022-07-31', '2022-08-31', '2022-09-30', '2022-10-31', '2022-11-30', '2022-12-31',
             '2023-01-31', '2023-02-28', '2023-03-31', '2023-04-30', '2023-05-31', '2023-06-30', '2023-07-31', '2023-08-31', '2023-09-30', '2023-10-31', '2023-11-30', '2023-12-31',
             '2024-01-31', '2024-02-29', '2024-03-31', '2024-04-30', '2024-05-31', '2024-06-30', '2024-07-31', '2024-08-31', '2024-09-30', '2024-10-31', '2024-11-30', '2024-12-31']),
    'Arrests': [115, 124, 144, 111, 145, 179, 147, 204, 240, 181, 155, 114,
                151, 126, 140, 165, 153, 162, 160, 191, 190, 190, 118, 123,
                141, 149, 151, 171, 163, 196, 162, 194, 173, 176, 182, 139,
                191, 188, 182, 171, 201, 189, 216, 190, 179, 175, 123, 145]
}

df_crimes = pd.DataFrame(crime_data)
df_arrests = pd.DataFrame(arrest_data)

fig = go.Figure()

# Add Total Crimes trace
fig.add_trace(go.Scatter(x=df_crimes['Date'], y=df_crimes['Crimes'],
                    mode='lines+markers',
                    name='Total Crimes',
                    line=dict(color='royalblue', width=2),
                    marker=dict(size=4)))

# Add Total Arrests trace
fig.add_trace(go.Scatter(x=df_arrests['Date'], y=df_arrests['Arrests'],
                    mode='lines+markers',
                    name='Total Arrests',
                    line=dict(color='green', width=2, dash='dash'),
                    marker=dict(size=4)))

fig.update_layout(
    title_text='<b>Monthly Crimes vs. Arrests in Albany, NY (2021-2024)</b>',
    xaxis_title='Month',
    yaxis_title='Number of Incidents',
    legend_title='Metric',
    font=dict(family="Arial, sans-serif", size=12, color="black"),
    plot_bgcolor='white',
    xaxis=dict(showgrid=True, gridcolor='lightgrey'),
    yaxis=dict(showgrid=True, gridcolor='lightgrey')
)

fig.write_html("interactive_crime_arrest_trends.html")
fig.show()